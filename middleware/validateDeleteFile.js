import { body, validationResult } from 'express-validator'
import {goPage} from '../utils.js'

const validateDeleteFile = [
    body('cid').exists().isLength({ max: 46, min: 46 }).trim().escape().withMessage('Maximum size 46 chars'),
    function(req,res,next) { 
        console.log('running middleware validate delete file ')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]

export default validateDeleteFile