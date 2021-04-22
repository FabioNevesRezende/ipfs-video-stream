const { User, AuthToken } = require('../persistence/models');

module.exports = async function(req, res, next) {
  console.log('running middleware auth')
  
  const token =
    req.cookies.authToken || req.headers.authorization;

  try{
    if (token) {
      console.log(`running middleware auth for token ${token}`)
      
      let user = await AuthToken.validate(token)

      if (user) {
        req.user = user;
      }
      else {
        res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Token' } });
        return;
      }
    }
    else
    {  
      res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Token' } });
      return;
    }
  }
  catch(err){
    res.status(500).render('main', {page: 'error', params: { errorMessage: 'Internal error' } });

  }
  next();
}