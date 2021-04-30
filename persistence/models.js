const Sequelize = require('sequelize');
const database = require('./db');
const bcrypt = require('bcrypt');
const saltRounds = 15;
var jwt = require('jsonwebtoken');
 
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
    const token = jwt.sign({ user }, user.username + user.password);
        
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
      const token = jwt.sign({ user }, process.env.JWT_SECRET );

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
  var token = jwt.sign({ user: { id: user.id, username: user.username, extra: (Math.random()*17) } }, user.password);
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
    tagName: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
    },
  },
  {
    timestamps: false
  }
)

const FileReaction = database.define('filereaction', {
    reaction: {
        type: Sequelize.STRING /* + ' CHARSET utf8mb4  COLLATE utf8mb4_bin'*/,
        allowNull: false,
        primaryKey: true
    },
    qtd: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1
    }
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

FileReaction.belongsTo(File);

File.hasMany(FileReaction);

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

Tag.belongsTo(File);

File.hasMany(Tag);

File.belongsTo(User);

User.hasMany(File);

File.associate = async (tagName,cid) => {
  try{
    const a = await Tag.create({
      tagName,
      fileCid: cid
    }) 
  } catch (err){
    console.log('File.associate error ' + err)
  }
} 

File.persist = async (originalFileName,cid,userId,size=undefined,mimetype=undefined) => {
    console.log('persistFile: ' + originalFileName)
  
    try{
    const file1 = await File.create({
        originalFileName,
        cid,
        userId,
        size,
        mimetype
    }) 
  } catch (err){
    console.log('File.persist error ' + err)
  }
};

File.getVideosHomePage = async() => {
  const fileTags = await Tag.findAll({include: [{ model: File }]});

  return fileTags;
};

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

module.exports.Tag = Tag;
module.exports.File = File;
module.exports.AuthToken = AuthToken;
module.exports.Comment = Comment;
module.exports.User = User;
module.exports.Userpendingupload = Userpendingupload;