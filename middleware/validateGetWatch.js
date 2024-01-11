import { query, validationResult } from 'express-validator'
import {goPage} from '../utils.js'

const validateGetWatch = [
    query('filehash').exists().matches(/Qm[A-Za-z0-9]{44}$/).withMessage('Invalid cid'),
    function(req,res,next) { 
        console.log('running middleware handle get watch')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]

export default validateGetWatch