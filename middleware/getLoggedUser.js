const { User, AuthToken } = require('../persistence/models');

module.exports = async function(req, res, next) {
  console.log('running middleware find logged user')
  
  const token = req.cookies.authToken ;

  try{

    if (token && token.length === 35) {
      console.log(`running middleware find logged user ${token}`)
      
      let user = await AuthToken.validate(token)

      if (user) {
        req.user = user;
      }
    }
  }
  catch(err){
    res.status(500).render('main', {page: 'error', params: { errorMessage: 'Internal error' } });

  }
  next();
}