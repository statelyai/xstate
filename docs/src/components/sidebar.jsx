import React from 'react';
import { Link, StaticQuery, graphql } from 'gatsby';
import sidebarStyles from './sidebar.module.css';
import cn from 'classnames';

console.log(sidebarStyles);

const sitemap = {
  guides: {
    title: 'Guides',
    pages: {
      start: {
        title: 'Getting Started'
      },
      installation: {
        title: 'Installation'
      },
      transitions: {
        title: 'Transitions'
      },
      actions: {
        title: 'Actions'
      },
      activities: {
        title: 'Activities'
      },
      communication: {
        title: 'Communication'
      },
      context: {
        title: 'Context'
      },
      delays: {
        title: 'Delays'
      },
      // faqs: {
      //   title: 'FAQs'
      // },
      final: {
        title: 'Final States'
      },
      guards: {
        title: 'Guards'
      },
      hierarchical: {
        title: 'Hierarchical States'
      },
      history: {
        title: 'History State Nodes'
      },
      ids: {
        title: 'Identifying States'
      },

      internal: {
        title: 'Internal Transitions'
      },
      interpretation: {
        title: 'Interpreting Machines'
      },
      parallel: {
        title: 'Parallel States'
      },
      states: {
        title: 'States'
      },
      typescript: {
        title: 'TypeScript Usage'
      }
    }
  },
  recipes: {
    title: 'Recipes',
    pages: {
      react: {
        title: 'React'
      },
      rxjs: {
        title: 'RxJS'
      }
    }
  },
  api: {
    title: 'API Docs',
    link: '/api/'
  }
};

export class Sidebar extends React.Component {
  renderPages(pages, parentKey) {
    return (
      <ul className={sidebarStyles.items}>
        {Object.keys(pages).map(key => {
          const page = pages[key];

          return (
            <li className={sidebarStyles.item}>
              <Link to={`${parentKey}/${key}`} className={sidebarStyles.link}>
                {page.title}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }
  render() {
    return (
      <nav className={sidebarStyles.nav}>
        <ul className={sidebarStyles.items}>
          {Object.keys(sitemap).map(key => {
            const { pages, title, link = `/${key}` } = sitemap[key];

            return (
              <li className={cn(sidebarStyles.item, sidebarStyles.topLevel)}>
                <Link to={link} className={sidebarStyles.link}>
                  {title}
                </Link>
                {pages && this.renderPages(pages, key)}
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
}
