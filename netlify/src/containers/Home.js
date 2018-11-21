import React from 'react'
import { withSiteData } from 'react-static'
//
import logoImg from '../logo.png'

export default withSiteData(() => (
  <div>
    <h1 style={{ textAlign: 'center' }}>Welcome to</h1>
    <img src={logoImg} alt="" style={{ display: 'block', margin: '0 auto' }} />
  </div>
))
