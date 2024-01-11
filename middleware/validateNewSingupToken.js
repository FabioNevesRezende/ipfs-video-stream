import { body, validationResult } from 'express-validator'
import {goPage} from '../utils.js'

const validateNewSingupToken = [
    body('email').exists().isEmail().normalizeEmail().trim().escape(),
    function(req,res,next) { 
        console.log('running middleware validate new singup token')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]

export default validateNewSingupToken