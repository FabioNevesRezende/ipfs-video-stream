import { User, AuthToken, Report }  from '../persistence/models.js'
import {goPage} from '../utils.js'

const getLoggedUser = async function(req, res, next){
  console.log('running middleware find logged user')
  
  const token = req.cookies.authToken || req.headers.authorization;

  try{

    if (token) {
      console.log(`running middleware find logged user ${token}`)
      
      let user = await AuthToken.validate(token)

      if (user) {
        console.log(`middleware found user ${user.username}`)
        req.user = user;
        if(user.adminLevel > 0){
          user.reports = await Report.getAll()
        }
      }
    }
  }
  catch(err){
    return goPage('error', req, res, { errorMessage: 'Internal error' }, 500 )

  }
  next();
}

export default getLoggedUser