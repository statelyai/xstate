const fs = require('fs');
const klaw = require('klaw');
const path = require('path');
const matter = require('gray-matter');

function getPosts() {
  const items = [];
  // Walk ("klaw") through posts directory and push file paths into items array //
  const getFiles = () =>
    new Promise(resolve => {
      // Check if posts directory exists //
      if (fs.existsSync('./src/posts')) {
        klaw('./src/posts')
          .on('data', item => {
            // Filter function to retrieve .md files //
            if (path.extname(item.path) === '.md') {
              // If markdown file, read contents //
              const data = fs.readFileSync(item.path, 'utf8');
              // Convert to frontmatter object and markdown content //
              const dataObj = matter(data);
              // Create slug for URL //
              dataObj.data.slug = dataObj.data.title
                .toLowerCase()
                .replace(/ /g, '-')
                .replace(/[^\w-]+/g, '');
              // Remove unused key //
              delete dataObj.orig;
              // Push object into items array //
              items.push(dataObj);
            }
          })
          .on('error', e => {
            console.log(e);
          })
          .on('end', () => {
            // Resolve promise for async getRoutes request //
            // posts = items for below routes //
            resolve(items);
          });
      } else {
        // If src/posts directory doesn't exist, return items as empty array //
        resolve(items);
      }
    });
  return getFiles();
}

function getGuides() {
  const items = [];
  // Walk ("klaw") through guides directory and push file paths into items array //
  const getFiles = () =>
    new Promise(resolve => {
      // Check if guides directory exists //
      if (fs.existsSync('./src/guides')) {
        klaw('./src/guides')
          .on('data', item => {
            // Filter function to retrieve .md files //
            if (path.extname(item.path) === '.md') {
              // If markdown file, read contents //
              const data = fs.readFileSync(item.path, 'utf8');
              // Convert to frontmatter object and markdown content //
              const dataObj = matter(data);
              // Create slug for URL //
              const title =
                dataObj.data.title || path.basename(item.path, '.md');
              dataObj.data.title = title;
              dataObj.data.slug = title
                .toLowerCase()
                .replace(/ /g, '-')
                .replace(/[^\w-]+/g, '');
              // Remove unused key //
              delete dataObj.orig;
              // Push object into items array //
              items.push(dataObj);
            }
          })
          .on('error', e => {
            console.log(e);
          })
          .on('end', () => {
            // Resolve promise for async getRoutes request //
            // guides = items for below routes //
            resolve(items);
          });
      } else {
        // If src/guides directory doesn't exist, return items as empty array //
        resolve(items);
      }
    });
  return getFiles();
}

export default {
  getSiteData: () => ({
    title: 'React Static with Netlify CMS'
  }),
  getRoutes: async () => {
    const posts = await getPosts();
    const guides = await getGuides();

    console.log(guides);
    return [
      {
        path: '/',
        component: 'src/containers/Home'
      },
      {
        path: '/about',
        component: 'src/containers/About'
      },
      {
        path: '/guides',
        component: 'src/containers/Guides',
        getData: () => ({ guides }),
        children: guides.map(guide => ({
          path: `/${guide.data.slug}`,
          component: 'src/containers/Guide',
          getData: () => ({
            guide
          })
        }))
      },
      {
        path: '/blog',
        component: 'src/containers/Blog',
        getData: () => ({
          posts
        }),
        children: posts.map(post => ({
          path: `/post/${post.data.slug}`,
          component: 'src/containers/Post',
          getData: () => ({
            post
          })
        }))
      },
      {
        is404: true,
        component: 'src/containers/404'
      }
    ];
  }
};
