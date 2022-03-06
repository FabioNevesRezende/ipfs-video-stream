const chai = require('chai')
const chaiHttp = require('chai-http')
chai.use(chaiHttp);
const expect = chai.expect;

const cheerio = require('cheerio')
const app = "http://localhost:3000" 
const agent = chai.request.agent(app)

function extractCsrfToken(res) {
    var $ = cheerio.load(res.text);
    return $('[name=_csrf]').val();
   }

describe('Post Endpoints', () => {
  it('should create a new user', () => {
    
    agent.get('/singup').end((err, resGet)=>{
          expect(err).to.be.null;
          expect(resGet).to.have.status(200)
          const _csrf = extractCsrfToken(resGet);

          console.log(`sending request with csrf token ${_csrf}`)
          agent
          .post('/singup')
          .set('CSRF-Token', _csrf)
          .send({
              username: "teste-automatizado2",
              email: 'alguem@gmail.com',
              password: '12345678',
              passwordConfirm: '12345678'
      
          }).end((err2, res)=>{
            expect(err2).to.be.null;
            expect(res).to.have.status(200)
          })
          
        })   
  })

  it('should login into a user', () => {
    
    agent.get('/login').end((err, resGet)=>{
          expect(err).to.be.null;
          expect(resGet).to.have.status(200)
          const _csrf = extractCsrfToken(resGet);

          console.log(`sending request with csrf token ${_csrf}`)
          agent
          .post('/login')
          .set('CSRF-Token', _csrf)
          .send({
              username: "ftk",
              password: '12345678'
      
          }).end((err2, res)=>{
            expect(err2).to.be.null;
            expect(res).to.have.cookie('authToken');
            expect(res).to.have.status(200)
          })
          
        })   
  })

})

agent.close()