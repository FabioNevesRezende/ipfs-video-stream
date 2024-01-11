import { body, validationResult } from 'express-validator'
import {goPage} from '../utils.js'

const validateResetPassword = [
    body('email').exists().isEmail().normalizeEmail().trim().escape(),
    function(req,res,next) { 
        console.log('running middleware validate reset password')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]

export default validateResetPassword