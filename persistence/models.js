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



User.authenticate = async (username,password) => {
    if(username && password) {
        console.log('authenticate: ' + username)

        const user1 = await User.findAll({
            where: {
                username: username
            }
        })
        if(user1[0])
        {
            bcrypt.compare(password, user1[0].password, function(err, res) {
                // if res == true, password matched
                // else wrong password
                if(res){
                    console.log('Usuário ' + username + ' autenticado')
                    return user1;
                }
                else {
                    console.log('Usuário ' + username + ' não autenticado')
                }
            });
        } else console.log('Usuário não encontrado')
        
    }
};

const AuthToken = database.define('authtoken', {
    token: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      }
});

AuthToken.associate = function({ User }) {
    AuthToken.belongsTo(User);
};
User.associate = function ({ AuthToken }) {
    User.hasMany(AuthToken);
};

AuthToken.generate = async function(UserId) {
  if (!UserId) {
    throw new Error('AuthToken requires a user ID')
  }
  let token = '';
  const possibleCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (var i = 0; i < 15; i++) {
    token += possibleCharacters.charAt(
      Math.floor(Math.random() * possibleCharacters.length) //unsafe
    );
  }
  return AuthToken.create({ token, UserId })
}

User.prototype.authorize = async function () {
    const { AuthToken } = database.models;
    const user = this
    // create a new auth token associated to 'this' user
    // by calling the AuthToken class method we created earlier
    // and passing it the user id
    const authToken = await AuthToken.generate(this.id);
    // addAuthToken is a generated method provided by
    // sequelize which is made for any 'hasMany' relationships
    await user.addAuthToken(authToken);
    return { user, authToken }
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