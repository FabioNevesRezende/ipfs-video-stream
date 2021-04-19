const Sequelize = require('sequelize');
const database = require('./db');
const bcrypt = require('bcrypt');
const saltRounds = 15;
 
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
        type: Sequelize.STRING,
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

AuthToken.generate = async function(userId) {
  if (!userId) {
    throw new Error('AuthToken requires a user ID')
  }
  let token = '';
  const possibleCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (var i = 0; i < 15; i++) {
    token += possibleCharacters.charAt(
      Math.floor(Math.random() * possibleCharacters.length) //unsafe
    );
  }
  return AuthToken.create({ token, userId })
}

User.prototype.authorize = async function () {
    const user = this

    const authToken = await AuthToken.generate(this.id);

    authToken.userId = user.id;

    return { user, authToken }
};

User.prototype.logout = async function (token) {
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

File.persist = async (originalFileName,fileCid,fileThumbId,size,mimetype) => {
    console.log('persistFile: ' + originalFileName)
  
    const file1 = await File.create({
        originalFileName,
        fileCid,
        fileThumbId,
        size,
        mimetype
    })
};

module.exports.Tag = Tag;
module.exports.File = File;
module.exports.FileTag = FileTag;
module.exports.AuthToken = AuthToken;
module.exports.User = User;