import { validationResult } from 'express-validator'
import {goPage} from '../utils.js'

const validateUpdateImage = [
    function(req,res,next) { 
        console.log('running middleware validate update image')
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        if(!req.files || !req.files.image){
            return goPage('error', req, res, { errorMessage: 'Invalid Input, there must be a image input' }, 400 )

        }
        next()
    }   
]

export default validateUpdateImage