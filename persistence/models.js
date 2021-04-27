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
    fileThumbId: {
        type: Sequelize.STRING,
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

File.persist = async (originalFileName,cid,fileThumbId,size=undefined,mimetype=undefined) => {
    console.log('persistFile: ' + originalFileName)
  
    try{
    const file1 = await File.create({
        originalFileName,
        cid,
        fileThumbId,
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

module.exports.Tag = Tag;
module.exports.File = File;
module.exports.AuthToken = AuthToken;
module.exports.User = User;