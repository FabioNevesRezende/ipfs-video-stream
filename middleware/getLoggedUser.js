const { User, AuthToken } = require('../persistence/models');

module.exports = async function(req, res, next) {
  console.log('running middleware find logged user')
  
  const token = req.cookies.authToken || req.headers.authorization;

  try{

    if (token) {
      console.log(`running middleware find logged user ${token}`)
      
      let user = await AuthToken.validate(token)

      if (user) {
        console.log(`middleware found user ${user.username}`)
        req.user = user;
      }
    }
  }
  catch(err){
    res.status(500).render('main', {page: 'error', params: { errorMessage: 'Internal error' } });

  }
  next();
}