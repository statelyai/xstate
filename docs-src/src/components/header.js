import React from 'react';
import { Link } from 'gatsby';
import logo from './xstate-logo.svg';
import githubIcon from './github.svg';
import menuIcon from './bars.svg';
import headerStyles from './header.module.css';
import cn from 'classnames';

const Header = ({ siteTitle, className, onToggleMenu }) => (
  <header className={cn(className, headerStyles.header)}>
    <Link
      to="/"
      style={{
        color: 'white',
        textDecoration: 'none'
      }}
      alt={siteTitle}
      className={headerStyles.logo}
    >
      <img src={logo} width="auto" />
    </Link>
    <div className={headerStyles.links}>
      <a
        href="https://statecharts.github.io/xstate-viz"
        className={headerStyles.viz}
      >
        viz
      </a>
      <a
        href="https://github.com/davidkpiano/xstate"
        alt="XState on GitHub"
        className={headerStyles.github}
      >
        <img src={githubIcon} width="auto" />
      </a>
      <button className={headerStyles.menu} onClick={onToggleMenu}>
        <img src={menuIcon} width="auto" />
      </button>
    </div>
  </header>
);

export default Header;
