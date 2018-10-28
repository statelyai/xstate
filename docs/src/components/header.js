import React from 'react';
import { Link } from 'gatsby';
import logo from './xstate-logo.svg';
import headerStyles from './header.module.css';
import cn from 'classnames';

const Header = ({ siteTitle, className }) => (
  <header className={cn(className, headerStyles.header)}>
    <img src={logo} className={headerStyles.logo} width="auto" />
    <h1 style={{ margin: 0 }}>
      <Link
        to="/"
        style={{
          color: 'white',
          textDecoration: 'none'
        }}
      >
        {siteTitle}
      </Link>
    </h1>
  </header>
);

export default Header;
