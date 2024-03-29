import { body, validationResult } from 'express-validator'
import {goPage} from '../utils.js'

const validateSearch = [
    body('term').exists().isLength({ max: 50 }).withMessage('Maximum size 50 chars').trim().escape(),
    function(req,res,next) { 
        console.log('running middleware validate search')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]

export default validateSearch