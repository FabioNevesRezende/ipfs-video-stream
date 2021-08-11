const Sequelize = require('sequelize');
const database = require('./db');
const OP = Sequelize.Op;
const bcrypt = require('bcrypt');
const saltRounds = 15;
var jwt = require('jsonwebtoken');
const fs = require('fs');
const fileIndex = require('./fileIndex')
const Path = require('path');

const User = database.define('user', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      unique: true,
      allowNull: false,
      primaryKey: true
    },
    email: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false,
    },
    username: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false,
    },
    password: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    telegramId: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: true,
    },
    confirmed: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    profilePhotoCid: {
        type: Sequelize.STRING,
        allowNull: true
    },
    lastLogin: {
      type: Sequelize.DATE,
      allowNull: true
    },
    adminLevel: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
});

User.updateProfilePhoto = async (user, cid) => {
  try{
    user.profilePhotoCid = cid
    await user.save()

    return user;
  }catch(err){
    console.log('User.prototype.updateProfilePhoto error: ' + err)
  }
}

const UserConfirmToken = database.define('userconfirmtoken', {
  token: {
      type: Sequelize.STRING(512),
      allowNull: false,
      unique: true,
      primaryKey: true
  }
},
{
  updatedAt: false
})

UserConfirmToken.belongsTo(User);

User.hasMany(UserConfirmToken);

User.newConfirmToken = async function(email){
  try{
    const user = await User.findOne( { where: {email} } );
    if(user){
      console.log(`found user ${user}`)
      const oldConfirmTokens = await UserConfirmToken.findAll({where: { userId: user.id }})
      for(const t of oldConfirmTokens){
        console.log(`Destroying old token ${t.token} for user ${user.id}`)
        await t.destroy();
      }

      return makeUserConfirmToken(user);
    }
  } catch(err){
    console.log('User.newConfirmToken error: ' + err)
  }
}

makeUserConfirmToken = async function(user){
  try{
    const token = jwt.sign({exp: Math.floor(Date.now() / 1000) + (86400) /* 24 hours */,  user }, user.username + user.password);
        
    const confirmToken = await UserConfirmToken.create({
      token, userId: user.id
    })

    user.confirmToken = confirmToken;
    return user;
    
  } catch(err){
    console.log('makeUserConfirmToken error: ' + err)
  }
}

const UserResetPasswordToken = database.define('userresetpasswordtoken', {
  token: {
      type: Sequelize.STRING(512),
      allowNull: false,
      unique: true,
      primaryKey: true
  }
},
{
  updatedAt: false
})

UserResetPasswordToken.belongsTo(User);

User.hasMany(UserResetPasswordToken);

User.resetPasswordToken = async (email) => {
  try{
    const user = await User.findOne( { where: {email} } );
    if(user){
      const token = jwt.sign({ exp: Math.floor(Date.now() / 1000) + (900) /* 15 minutes */, user }, process.env.JWT_SECRET );

      const resetToken = await UserResetPasswordToken.create({
        token, userId: user.id
      })

      user.resetToken = resetToken

      return user;

    }
  }catch(err){
    console.log('User.resetPasswordToken error: ' + err)
  }
}

User.resetPassword = async (password, token) => {
  const dbToken = await UserResetPasswordToken.findOne( {where: { token }, include: [{ model: User }]} )

  if(dbToken && dbToken.user){
    cAt = new Date(dbToken.createdAt)
    limit = new Date(cAt.getTime() + 1000 * 60 * 60) // 1 hour
    if( (new Date()).getTime() > limit.getTime()){
      dbToken.destroy()
      return false
    }
    var decoded = jwt.verify(token, process.env.JWT_SECRET)

    if(decoded && decoded.user){

      const hash = bcrypt.hashSync(password, saltRounds)
      dbToken.user.password = hash
      const user = dbToken.user

      await user.save()

      dbToken.destroy()

      return user
    }
  }
  return false

}

User.createNew = async (email,username,password,telegramId=null) => {
    console.log('persistUser: ' + username)

    try{
      const hash = bcrypt.hashSync(password, saltRounds);

      const user = await User.create({
          email,
          telegramId,
          username,
          password: hash
      })

      return makeUserConfirmToken(user);

  } catch (err){
    console.log('User.createNew error ' + err)
  }

};

User.validateSingup = async (token) => {
  const dbToken = await UserConfirmToken.findOne( {where: { token }, include: [{ model: User }]} )

  if(dbToken && dbToken.user){
    cAt = new Date(dbToken.createdAt)
    limit = new Date(cAt.getTime() + 1000 * 60 * 60) // 1 hour
    if( (new Date()).getTime() > limit.getTime()){
      dbToken.destroy()
      return false;
    }
    var decoded = jwt.verify(token, dbToken.user.username + dbToken.user.password)

    if(decoded && decoded.user){

      dbToken.user.confirmed = true
      await dbToken.user.save()

      dbToken.destroy()

      return true
    }
  }
  return false
}


User.prototype.verifyToken = function(token){
  var decoded = jwt.verify(token, this.password)
  return decoded && decoded.user && decoded.user.extra
  
}

User.authenticate = async function(username, password) {

    const user = await User.findOne({ where: { username } });

    if (bcrypt.compareSync(password, user.password)) {
      return user.authorize();
    }

    throw new Error('invalid password');
}

User.prototype.changePassword = async function(oldPassword, newPassword){
  try{
    if (bcrypt.compareSync(oldPassword, this.password)) {
      const hash = bcrypt.hashSync(newPassword, saltRounds)
      this.password = hash
  
      await this.save()
      return true;
    }
  } catch(err){
    console.log('User.prototype.changePassword error: ' + err)
    return false;
  }
}

User.updateData = async (user, password) => {
  try{
    if (bcrypt.compareSync(password, user.password)) {
      await user.save()
      return true
    }

  }catch(err){
    console.log('User.updateData error: ' + err)
  }

  return false
}

User.remove = async(id, password=undefined) => {
  try{
    const user = await User.findOne({where: {id}})

    if (password && bcrypt.compareSync(password, user.password)) {
      console.log(`Removing user ${user.username} with verified password`)
      await user.destroy()
      return true;
    }
    if(!password) {
      console.log(`Removing user ${user.username} without verify password`)
      await user.destroy()
      return true;
    }
    console.log('User.remove wrong password')
    return false

  }catch(err){
    console.log('User.remove error: ' + err)
  }

}

const AuthToken = database.define('authtoken', {
    token: {
        type: Sequelize.STRING(512),
        allowNull: false,
        unique: true,
        primaryKey: true
      }
});

AuthToken.belongsTo(User);

User.hasMany(AuthToken);

AuthToken.generate = async function(user){
  var token = jwt.sign({ exp: Math.floor(Date.now() / 1000) + (604800) /* 7 days */, user: { id: user.id, username: user.username, extra: (Math.random()*17) } }, user.password);
  return await AuthToken.create({ token, userId: user.id })
}

AuthToken.validate = async function(token){
  try{
    if(token){
      const authToken = await AuthToken.findOne(
        { where: { token } }
      );
      if(authToken){
        const user = await User.findOne({where: { id: authToken.userId }}) // 2 query, mt ruim
        if(user.verifyToken(token)){
          user.authToken = token
        } else {
          authToken.destroy({ where: {token}})
        }
        return user
      }
    }
  } catch(err){
    return;
  }
}

User.prototype.authorize = async function (token=undefined) {
  const user = this
  let at = null
  if(!token){
    at = await AuthToken.generate(user);
  } else {
    at = await AuthToken.findOne({ where: {token}});
  }
  if(at!==null){
    at.userId = user.id;
    user.authToken = at.token;
    return  user
  }
};

User.logout = async function (token) {
    AuthToken.destroy({ where: { token } });
};

User.createUser = async function(email,username,password){
    const file1 = await User.create({email,username,password});
}
const File = database.define('file', {
    originalFileName: {
        type: Sequelize.STRING,
        allowNull: false
    },
    cid: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    duration: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    size: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    mimetype: {
        type: Sequelize.STRING,
        allowNull: true
    }
})
 
const Tag = database.define('tag', {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
    },
  },
  {
    timestamps: false
  }
)
 
const Filetag = database.define('filetag', {},
  {
    timestamps: false
  }
)

const FileReaction = database.define('filereaction', {
    num: {
      type: Sequelize.INTEGER, // 0 like, 1 dislike, 2 heart, 3 happy face, etc
      allowNull: false
    },
  },
  {
    timestamps: false
  }
)


const Comment = database.define('comment', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  text: {
      type: Sequelize.STRING(512)  /* + ' CHARSET utf8mb4  COLLATE utf8mb4_bin' */,
      allowNull: false
  }
},
{
  timestamps: false
}
)

Comment.belongsTo(File);

File.hasMany(Comment);

Comment.belongsTo(User);

User.hasMany(Comment);

User.belongsToMany(File, { through: FileReaction })

File.belongsToMany(User, { through: FileReaction })


File.react = async (fileCid, userId, num) => {
  try{
    const fr = await FileReaction.findOrCreate({ 
      where: {fileCid, userId},
      defaults: {num}
    })
    fr[0].num = num
    await fr[0].save()
    return fr[0];
  } catch (err){
    console.log('File.react FileReaction.create error ' + err)
  }
}

File.reactions = async (cid) => {
  try{
    const fr = await FileReaction.findAll({where: {fileCid:cid}})
    return fr;
  }catch(err){
    console.log('File.reactions error ' + err)
    
  }
}

Comment.createNew = async (text, userId, fileCid) => {
  console.log('Comment.createNew: ' + text)
  try{

    const c = await Comment.create({text, userId, fileCid})

    return c;

  } catch (err){
    console.log('Comment.createNew error ' + err)
  }

};

Comment.ofFile = async(fileCid) => {
  console.log('Comment.ofFile: ' + fileCid)
  try{

    const cs = await Comment.findAll({ where: {fileCid}, include: [{ model: User }] })

    return cs;

  } catch (err){
    console.log('Comment.ofFile error ' + err)
  }
}

Comment.remove = async(id, userId) => {
  console.log('Comment.remove: ' + id)
  try{
    const c = await Comment.findOne({ where: {id, userId} })
    if(c) {
      c.destroy()
      return;
    }
    console.log(`Comment.remove: invalid userId ${userId} for comment ${id}`)

  } catch (err){
    console.log('Comment.remove error ' + err)
  }

}

Comment.removeById = async(id) => {
  console.log('Comment.removeById: ' + id)
  try{
    const c = await Comment.findOne({ where: {id} })
    if(c) {
      c.destroy()
      return;
    }
    console.log(`Comment.removeById: invalid comment id ${id}`)

  } catch (err){
    console.log('Comment.removeById error ' + err)
  }

}

Tag.belongsToMany(File, { through: Filetag });

File.belongsToMany(Tag, { through: Filetag })

File.belongsTo(User, {foreignKey: 'op', targetKey: 'id'} );

User.hasMany(File, {foreignKey: 'op', targetKey: 'id'} );

File.associate = async (name,cid) => {
  try{
    const t = await Tag.create({
      name
    }) 
  } catch (err){
    console.log('File.associate Tag.create error ' + err)
  }

  try{
    const ft = await Filetag.create({
      tagName: name, fileCid: cid
    }) 
  } catch (err){
    console.log('File.associate Filetag.create error ' + err)
  }
} 

File.persist = async (args) => {
  try{
    console.log('persistFile: ' + args.originalFileName)
  
      const file1 = await File.create(args) 
  } catch (err){
    console.log('File.persist error ' + err)
  }
};

File.getVideosHomePage = async() => {
  const files = await File.findAll({include: [{model: User}, {model: Tag}], order: [['createdAt', 'desc']], limit: 20 })

  for(const f of files){
    f.op = await User.findOne({where: { id: f.op }})
  }

  return files;
};

File.delete = async(cid) => {
  try{
    File.destroy({ where: { cid }})
  }catch(err){
    console.log('File.delete error ' + err)
  }
}

File.getByCid = async(cid) => {
  try{
    const file = await File.findOne({ where: { cid }, include: [{model: Comment, include: [{model: User}] }, {model: Tag}] })
    file.op = await User.findOne({where: { id: file.op }})
    return file
  }catch(err){
    console.log('File.getByCid error ' + err)
  }
}

File.indexFile = ({originalFileName,cid,description,categories}) => {

  for(const c of categories.split(',')){
    if(fileIndex[c]){
      fileIndex[c].push(cid)
    } else {
      fileIndex[c] = []
      fileIndex[c].push(cid)
    }
  }
  for(const c of originalFileName.split(' ')){
    if(fileIndex[c]){
      fileIndex[c].push(cid)
    } else {
      fileIndex[c] = []
      fileIndex[c].push(cid)
    }
  }

  for(const c of description.split(' ')){
    if(fileIndex[c]){
      fileIndex[c].push(cid)
    } else {
      fileIndex[c] = []
      fileIndex[c].push(cid)
    }
  }


  const indexJson = Path.join(__dirname, 'fileIndex.json')

  fs.writeFile(indexJson,  JSON.stringify(fileIndex), (err) => {
    if (err) {
      console.log("Error updating fileIndex.json: ");
      console.log(err)
    }
    console.log("JSON data is saved to fileIndex.json");
  });

}

File.videosFromTerm = async (term) => {
  let cids = []
  for(const w of term.split(' ')){
    if(fileIndex[w]){
      for(const cid of fileIndex[w])
        cids.push(cid)
    }
  }

  const files = await File.findAll({include: [{model: User}], order: [['createdAt', 'desc']], where: {cid: cids} })

  return files;

}

User.withProfileData = async (userId) => {
  try{
    const user = await User.findAll({ where: {id: userId}, include: [{model: File},{model: Userpendingupload}] })
    if(user && user[0])
    return user[0]

  }catch(err){
    console.log('File.ofUser error: ' + err)
  }
}

const Userpendingupload = database.define('userpendingupload', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  originalFileName: {
      type: Sequelize.STRING,
      allowNull: false
  }
},
{
  updatedAt: false
}
)

Userpendingupload.belongsTo(User);

User.hasMany(Userpendingupload);

Userpendingupload.newUpload = async (userId, originalFileName) => {
  try{
    const u = await Userpendingupload.create({
      userId, originalFileName
    })

    return u.id;
  }catch(err){
    console.log('Userpendingupload.newUpload error: ' + err)
  }
}

Userpendingupload.done = async (id) => {
  try{
    Userpendingupload.destroy({where: {id}})
  }catch(err){
    console.log('Userpendingupload.done error: ' + err)
  }
}

doDbMaintenance = async() => {
  try{
    console.log('doDbMaintenance start')
    var atdate = new Date();
    var uctdate = new Date();
    var udate = new Date();
    var urptdate = new Date();

    atdate.setDate( atdate.getDate() - 7 );
    uctdate.setDate( uctdate.getDate() - 1 );
    udate.setDate( udate.getDate() - 60 );
    urptdate.setMinutes( udate.getMinutes() - 15 );

    AuthToken.destroy({ where: { createdAt: { [OP.lt]: atdate  } } })
    UserConfirmToken.destroy({ where: { createdAt: { [OP.lt]: uctdate  } } })
    User.destroy({ where: { lastLogin: { [OP.lt]: udate  } } })
    UserResetPasswordToken.destroy({ where: { createdAt: { [OP.lt]: urptdate  } } })
    console.log('doDbMaintenance end')

  }catch(err){
    console.log('doDbMaintenance error: ' + err)
  }

}

module.exports.Tag = Tag;
module.exports.File = File;
module.exports.AuthToken = AuthToken;
module.exports.Comment = Comment;
module.exports.User = User;
module.exports.Userpendingupload = Userpendingupload;
module.exports.doDbMaintenance = doDbMaintenance;