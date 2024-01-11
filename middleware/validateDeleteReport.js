import { body, validationResult } from 'express-validator'
import {goPage} from '../utils.js'

const validateDeleteReport = [
    body('id').exists().isInt({ min: 0, max: 9999999 }).withMessage('Maximum type is 9999999').trim().escape(),
    function(req,res,next) { 
        console.log('running middleware validate delete report ')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]

export default validateDeleteReport