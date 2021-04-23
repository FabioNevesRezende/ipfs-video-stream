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
});

User.persist = (email,username,password,telegramId=null) => {
    console.log('persistUser: ' + username)

    const hash = bcrypt.hashSync(password, saltRounds);

    const user1 = User.create({
        email,
        telegramId,
        username,
        password: hash
    })
    
    return user1;

};



User.prototype.verifyToken = function(token){
  var decoded = jwt.verify(token, this.password)
  if(decoded && decoded.user){
    return {...decoded.user, authToken: token }
  }
}

User.authenticate = async function(username, password) {

    const user = await User.findOne({ where: { username } });

    // bcrypt is a one-way hashing algorithm that allows us to 
    // store strings on the database rather than the raw
    // passwords. Check out the docs for more detail
    if (bcrypt.compareSync(password, user.password)) {
      return user.authorize();
    }

    throw new Error('invalid password');
}

const AuthToken = database.define('authtoken', {
    token: {
        type: Sequelize.STRING(512),
        allowNull: false,
        unique: true,
        primaryKey: true
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true
      }
});

AuthToken.associate = function({ User }) {
    AuthToken.belongsTo(User, {foreignKey: 'userId'});
};

User.associate = function ({ AuthToken }) {
    User.hasMany(AuthToken);
};

AuthToken.generate = function(user){
  var token = jwt.sign({ user }, user.password);
  return AuthToken.create({ token, userId: user.id })
}

AuthToken.validate = async function(token){
  try{
    if(token){
      const authToken = await AuthToken.findOne(
        { where: { token } }
      );
      if(authToken){
        const user = await User.findOne({where: { id: authToken.userId }}) // 2 query, mt ruim
        return user.verifyToken(token);
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

    return {...user, authToken: at.token }
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
    fileCid: {
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
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
    }
})

const FileTag = database.define('filetag', {
    tagName: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
    },
    fileCid: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
    }
})

File.persist = async (originalFileName,fileCid,fileThumbId,size=undefined,mimetype=undefined) => {
    console.log('persistFile: ' + originalFileName)
  
    try{
    const file1 = await File.create({
        originalFileName,
        fileCid,
        fileThumbId,
        size,
        mimetype
    }) 
  } catch (err){
    console.log('File.persist error ' + err)
  }
};

module.exports.Tag = Tag;
module.exports.File = File;
module.exports.FileTag = FileTag;
module.exports.AuthToken = AuthToken;
module.exports.User = User;