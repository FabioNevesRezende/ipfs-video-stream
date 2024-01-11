import { param, validationResult } from 'express-validator'
import {goPage} from '../utils.js'

const validateGetUser = [
    param('id').exists().isInt({ min: 1, max: 1000000000 }).withMessage('Maximum user id 1000000000').trim().escape(),
    function(req,res,next) { 
        console.log('running middleware validate get user')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]

export default validateGetUser