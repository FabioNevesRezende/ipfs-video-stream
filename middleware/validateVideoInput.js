const { check, body, validationResult } = require('express-validator');

module.exports = [
    body('fileName').exists().isLength({ max: 25 }).withMessage('Maximum size 25 chars').trim().escape(),
    body('categories').exists().isLength({ max: 1024 }).withMessage('Maximum size 1024 chars').trim().escape(),
    function(req,res,next) { 
        console.log('running middleware validate video input')
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input' }});
        }

        if(!req.files || !req.files.file){
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input, there must be a file input' }});

        }
        next()
    }   
]