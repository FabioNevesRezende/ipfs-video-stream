const Sequelize = require('sequelize');
const { QueryTypes } = require('sequelize');
const database = require('./db');
const OP = Sequelize.Op;
const bcrypt = require('bcrypt');
const saltRounds = 15;
var jwt = require('jsonwebtoken');
const fs = require('fs');
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
    },
    hostIpfsCopy: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
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
      type: Sequelize.STRING(768),
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
        type: Sequelize.STRING(64),
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

const UserFileRepeat = database.define('userfilerepeat', {},
{
  timestamps: false
}
)

User.belongsToMany(File, { through: UserFileRepeat })

File.belongsToMany(User, { through: UserFileRepeat })

UserFileRepeat.associate = async (userId, fileCid) => {
  try{
    const testExists = await File.findOne({ where: { op: userId, cid: fileCid } })
    if(testExists) 
      return;

    await UserFileRepeat.create({userId, fileCid})
  }catch(err){
    console.log(`UserFileRepeat.associate error: ${err}`)
  }
}

UserFileRepeat.allByUserId = async (userId) => {
  try{

  const files = await database.query(
    'SELECT f.cid, f.originalFileName, f.duration, u.id \
    FROM files f \
    inner join userfilerepeats ufr on ufr.fileCid = f.cid \
    inner join users u on u.id = ufr.userId \
    WHERE u.id = :userId',
    {
      replacements: { userId },
      type: QueryTypes.SELECT
    }
  );

    return files;
  }catch(err){
    console.log(`UserFileRepeat.allByUserId error: ${err}`)
  }
}

UserFileRepeat.allByFileCid = async (fileCid) => {
  try{

    const files = await database.query(
      'SELECT f.cid, f.originalFileName, f.duration, u.username, u.id, u.profilePhotoCid \
      FROM files f \
      inner join userfilerepeats ufr on ufr.fileCid = f.cid \
      inner join users u on u.id = ufr.userId \
      WHERE f.cid = :fileCid',
      {
        replacements: { fileCid },
        type: QueryTypes.SELECT
      }
    );
  
      return files;
    }catch(err){
      console.log(`UserFileRepeat.allByFileCid error: ${err}`)
    }
}

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

File.persist = async (args,cache) => {
  try{
    console.log('persistFile: ' + args.originalFileName)
  
      const file1 = await File.create(args) 
      cache.cleanWhere('File')
  } catch (err){
    console.log('File.persist error ' + err)
    if(err.name === "SequelizeUniqueConstraintError")
      return false
  }
  return true
};

File.getVideosHomePage = async(cache) => {
  const key = 'KeyFile_VideosHomePage';
  if(!cache.get(key)){
  const files = await File.findAll({attributes: ['cid', 'originalFileName', 'duration', 'createdAt', 'op'], order: [['createdAt', 'desc']], limit: 20 })

  for(const f of files){
    f.op = await User.findOne({attributes: ['username', 'id'], where: { id: f.op }})
  }

    console.log(`Criando cache para ${key}`)
    cache.put(key, files)
  return files;
  }
  else {
    console.log(`Retornando cache armazenado para ${key}`)
    return cache.get(key)
  }
};

File.getRandomCids = async() => {
  const files = await database.query(
    'SELECT f.cid, ft.tagName as name  \
    FROM files f \
    inner join filetags ft on f.cid = ft.fileCid',
    {
      type: QueryTypes.SELECT
    }
  );

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

const IndexTable = database.define('indextable', {
  word: {
    type: Sequelize.STRING,
    allowNull: false,
    primaryKey: true
  },
  cid: {
      type: Sequelize.STRING,
      allowNull: false,
      primaryKey: true
  },
},
{
  timestamps: false
})


File.indexFile = async ({originalFileName,cid,description,categories}) => {

  for(const temp of categories.split(',')){
    const word = temp.trim()
    if(word === '') continue;
    try{
      await IndexTable.create({word, cid})
    } catch(err){
      console.log(`File.indexFile error: ${err}`)
    }
  }
  for(const temp of originalFileName.split(' ')){
    const word = temp.trim()
    if(word === '') continue;
    try{
      await IndexTable.create({word, cid})
    } catch(err){
      console.log(`File.indexFile error: ${err}`)
    }
  }

  for(const temp of description.split(' ')){
    const word = temp.trim()
    if(word === '') continue;
    try{
      await IndexTable.create({word, cid})
    } catch(err){
      console.log(`File.indexFile error: ${err}`)
    }
  }

}

File.videosFromTerm = async (term) => {
  let words = []
  for(const word of term.split(' ')){
    words += word
  }
  const files = await database.query(
    'SELECT f.cid, f.originalFileName, f.duration, u.username, u.id \
    FROM files f \
    inner join indextables i on i.cid = f.cid \
    inner join users u on u.id = f.op \
    WHERE i.word IN(:words)',
    {
      replacements: { words: words },
      type: QueryTypes.SELECT
    }
  );

  for(const f of files){
    f.op = {}
    f.op.username = f.username
    f.op.id = f.id
  }

  return files;

}

File.reindex = async () => {
  const files = await File.findAll({ attributes: ['originalFileName', 'cid', 'description'] })
  for(const f of files){
    const tagsOfFile = await Filetag.findAll({where: {fileCid: f.cid}})
    let tgs = ""
    for(const t of tagsOfFile){
      tgs += t.tagName + ","
    }
    await File.indexFile({originalFileName: f.originalFileName, cid: f.cid, description: f.description, categories: tgs})
  }
}

User.withProfileData = async (id) => {
  try{
    const user = await User.findOne({ where: {id}, include: [{model: File},{model: Userpendingupload}] })
    if(user)
      return user

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

const FilePendingDeletion = database.define('filependingdeletion', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  dirname: {
      type: Sequelize.STRING,
      allowNull: false
  }
},
{
  updatedAt: false
}
)

FilePendingDeletion.schedule = async (dirname) => {
  try{
    await FilePendingDeletion.create({dirname})
  }catch(err){
    console.log('FilePendingDeletion.schedule error: ' + err)
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

    await AuthToken.destroy({ where: { createdAt: { [OP.lt]: atdate  } } })
    await UserConfirmToken.destroy({ where: { createdAt: { [OP.lt]: uctdate  } } })
    await User.destroy({ where: { lastLogin: { [OP.lt]: udate  } } })
    await UserResetPasswordToken.destroy({ where: { createdAt: { [OP.lt]: urptdate  } } })
    console.log('doDbMaintenance end')

  }catch(err){
    console.log('doDbMaintenance error: ' + err)
  }

}

FilePendingDeletion.checkFilePendingDeletion = async (streamableDir) => {
  try{
    console.log('FilePendingDeletion.checkFilePendingDeletion start')
    var fpddate = new Date();
    fpddate.setDate( fpddate.getDate() - 1 );

    const fpds = await FilePendingDeletion.findAll({where: { createdAt: { [OP.lt]: fpddate  } }})

    for(const f of fpds ){
      path = Path.join(streamableDir, f.dirname)
      console.log(`Deleting content of ${path}`)
      fs.rmSync(path, {recursive: true})
      await f.destroy();
    }

    console.log('FilePendingDeletion.checkFilePendingDeletion end')
  }catch(err){
    console.log('FilePendingDeletion.checkFilePendingDeletion error: ' + err)
  }
}

const ReportType = database.define('reporttype', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  type: {
      type: Sequelize.STRING('50'),
      allowNull: false
  }
},
{
  timestamps: false
})

const Report = database.define('report', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  }
},
{
  updatedAt: false
}
)

Report.belongsTo(User, {as: 'madeBy'});
Report.belongsTo(User, {as: 'reported'});
Report.belongsTo(ReportType, {as: 'type'});
Report.belongsTo(File);

Report.register = async (madeById,reportedId,fileCid,type) => {
  try{
    const rep = await Report.create({madeById,reportedId,fileCid,typeId: type})

    return rep

  }catch(err){
    console.log('Report.register error: ' + err)
  }
}

Report.delete = async (id) => {
  try{
    await Report.destroy({ where: { id }})

  }catch(err){
    console.log('Report.delete error: ' + err)
  }
}

Report.getAll = async () => {
  try{

    const reports = await database.query(
      'SELECT r.id, r.typeId, rt.type, r.fileCid, r.madeById, r.reportedId, u1.username as reportedName, u2.username as madeBy \
      FROM reports r \
      left join users u1 on u1.id = r.reportedId \
      inner join users u2 on u2.id = r.madeById \
      inner join reporttypes rt on rt.id = r.typeId ',
      { type: QueryTypes.SELECT }
    );

    return reports;
  }catch(err){
    console.log(`Report.getAll error: ${err}`)
  }
}

const Message = database.define('message', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  content: {
      type: Sequelize.STRING(512),
      allowNull: false
  },
  read: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
    allowNull: false
  }
},
{
  timestamps: false
}
)

Message.belongsTo(User, {as: 'from'});
Message.belongsTo(User, {as: 'to'});


User.receiveMessages = async (userId) => {
  try{
    const msgs = await Message.findAll({where: {toId: userId} })
    return msgs
  }catch(err){
    console.log('User.receiveMessages error: ' + err)

  }

  return []
}

User.sentMessages = async (userId) => {
  try{
    const msgs = await Message.findAll({where: {fromId: userId} })
    return msgs
  }catch(err){
    console.log('User.sentMessages error: ' + err)

  }

  return []
}

Message.read = async (id) => {
  try{
    const msg = await Message.findOne({id})

    msg.read = true
    await msg.save()

  }catch(err){
    console.log('Message.read error: ' + err)
  }

}

Message.register = async (content, userId) => {
  try{
    await Message.create({content, userId})

  }catch(err){
    console.log('Message.register error: ' + err)
  }

}

module.exports.Tag = Tag;
module.exports.File = File;
module.exports.Report = Report;
module.exports.AuthToken = AuthToken;
module.exports.Comment = Comment;
module.exports.User = User;
module.exports.Userpendingupload = Userpendingupload;
module.exports.doDbMaintenance = doDbMaintenance;
module.exports.FilePendingDeletion = FilePendingDeletion;
module.exports.UserFileRepeat = UserFileRepeat;
