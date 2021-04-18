const Sequelize = require('sequelize');
const cnx = new Sequelize('mysql://glaurung:12345678@127.0.0.1:3306/glaurung');


module.exports = cnx;