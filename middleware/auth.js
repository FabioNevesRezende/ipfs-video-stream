const { User, AuthToken } = require('../persistence/models');

module.exports = async function(req, res, next) {
  console.log('running middleware auth')
  // look for an authorization header or auth_token in the cookies
  const token =
    req.cookies.authToken || req.headers.authorization;

  // if a token is found we will try to find it's associated user
  // If there is one, we attach it to the req object so any
  // following middleware or routing logic will have access to
  // the authenticated user.
  try{
    if (token) {
      console.log(`running middleware auth for token ${token}`)
      
      let user = await AuthToken.validate(token)

      // if there is an auth token found, we attach it's associated
      // user to the req object so we can use it in our routes
      if (user) {
        req.user = user;
      }
      else {
        res.status(400).render('main', {page: '400', params: {} });
        return;
      }
    }
    else
    {  
      res.status(400).render('main', {page: '400', params: {} });
      return;
    }
  }
  catch(err){
    res.status(500).render('main', {page: '500', params: {} });

  }
  next();
}