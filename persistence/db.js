const Sequelize = require('sequelize');
const cnx = new Sequelize(process.env.DB_CONNECTION_STRING);


module.exports = cnx;