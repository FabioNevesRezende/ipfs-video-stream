
const nodeMailer = require('nodemailer')
require('dotenv').config()
var sgTransport = require('nodemailer-sendgrid-transport');

const transporter = nodeMailer.createTransport(sgTransport({
    auth: {
        api_key: process.env.SENDGRID_API_KEY
    }
  }
));

// EXPORTS:
const goPage = async(page, req, res, args, httpCode=200) => {
    if(req.user && !args.user){
        args.user = req.user
    }
    if(page === "error" && httpCode == 200) httpCode = 500;
    return res.status(httpCode).render('main', {page, params: {...args, appname: process.env.APPNAME }})
}

const sendConfirmEmail = (user) => {
    try{
        console.log(`Sending confirmation email to ${user.email}`)
        
        const mailOptions = {
        from: process.env.FROM_EMAIL,
        to: user.email,
        subject: 'Confirm register',
        html: `<p><a href="${process.env.ORIGIN_NAME}/validateSingupToken?token=${user.confirmToken.token}">Click here</a> to confirm your registration</p>`
        };
        
        transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
        });
    } catch(err){
        console.log('sendConfirmEmail error: ' + err)
    }
}

const sendEmailResetPassword = (user) => {
    try{
        console.log(`Sending confirmation email to ${user.email}`)
        
        const mailOptions = {
        from: process.env.FROM_EMAIL,
        to: user.email,
        subject: 'Reset password',
        html: `<p><a href="${process.env.ORIGIN_NAME}/forgotPassword?token=${user.resetToken.token}">Click here</a> to reset your password</p>`
        };
        
        transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
        });
    } catch(err){
        console.log('sendEmailResetPassword error: ' + err)
    }

}

module.exports = {
    goPage, sendConfirmEmail, sendEmailResetPassword
}