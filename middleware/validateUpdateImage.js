const { check, body, validationResult } = require('express-validator');
const {goPage} = require('../utils')

module.exports = [
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