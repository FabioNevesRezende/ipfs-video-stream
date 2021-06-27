const chai = require('chai')
const expect = chai.expect
const {isCidRegex} = require('./utils')
var should = require('chai').should();

describe('isCidRegex()', () => {
    it('true for QmRJXvE9JFDvUHeX91sQPjFQ95Yh8zS4qh2Vi1quqPm52T', () => {
        expect(isCidRegex('QmRJXvE9JFDvUHeX91sQPjFQ95Yh8zS4qh2Vi1quqPm52T')).to.equals(1)
        
    })

    it('throw for QmRJXvE9JFDvUHeX91sQPjFQ95Yh8zS4qh2Vi1quqPm52I', () => {
        expect(isCidRegex('QmRJXvE9JFDvUHeX91sQPjFQ95Yh8zS4qh2Vi1quqPm52I')).to.equals(0)
        
        
    })
})

