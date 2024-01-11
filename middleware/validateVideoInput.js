import { body,  validationResult } from 'express-validator'
import {goPage} from '../utils.js'

const validateVideoInput = [
    body('fileName').exists().isLength({ max: 25 }).withMessage('Maximum size 25 chars').trim().escape(),
    body('categories').exists().isLength({ max: 1024 }).withMessage('Maximum size 1024 chars').trim().escape(),
    body('description').exists().isLength({ max: 1024 }).withMessage('Maximum size 1024 chars').trim().escape(),
    function(req,res,next) { 
        console.log('running middleware validate video input')
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        if(!req?.files?.file){
            return goPage('error', req, res, { errorMessage: 'Invalid Input, there must be a file input' }, 400 )

        }

        const availableMimes = require('./availableMimes.json')
        const fileMime = req.files.file.mimetype
        if(!availableMimes.includes(fileMime)){
            return goPage('error', req, res, { errorMessage: 'Invalid file type' }, 400 )
        }

        next()
    }   
]

export default validateVideoInput