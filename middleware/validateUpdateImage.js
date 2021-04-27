const { check, body, validationResult } = require('express-validator');

module.exports = [
    function(req,res,next) { 
        console.log('running middleware validate update image')
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input' }});
        }

        if(!req.files || !req.files.image){
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input, there must be a image input' }});

        }
        next()
    }   
]