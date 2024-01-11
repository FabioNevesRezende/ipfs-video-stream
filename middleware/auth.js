import { User, AuthToken } from '../persistence/models.js'
import {goPage} from '../utils.js'

const AuthMiddleware = async function(req, res, next) {
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
        return goPage('error', req, res, { errorMessage: 'Invalid Token' }, 400 )
      }
    }
    else
    {  
      return goPage('error', req, res, { errorMessage: 'Invalid Token' }, 400 )
    }
  }
  catch(err){
    return goPage('error', req, res, { errorMessage: 'Internal error' }, 500 )

  }
  next();
}

export default AuthMiddleware