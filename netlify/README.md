# React Static - Netlify CMS Example

React Static basic template with added configuration for use with Netlify CMS and GitHub.

To get started, click below to deploy to Netlify.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/tsgriff/react-static-netlifycms)

Or, copy this folder and signup with [Netlify](https://www.netlify.com), click "New site from Git", select GitHub, and add `yarn build` as the "Build command" and `dist` as the "Publish directory".

Your app should now be available as a repository on your GitHub profile.

## Authorization and Access to Netlify CMS

Once your site is deployed to GitHub configure authorization in Netlify by following the instructions below.

[Information on authentication and logging into Netlify CMS from Netlify's documentation:](https://www.netlifycms.org/docs/add-to-your-site/#authentication)

1. Go to Settings > Identity, and select Enable Identity service.

2. Under Registration preferences, select Open or Invite only. In most cases, you’ll want only invited users to access your CMS, but if you’re just experimenting, you can leave it open for convenience.

3. If you’d like to allow one-click login with services like Google and GitHub, check the boxes next to the services you’d like to use, under External providers.

4. Scroll down to Services > Git Gateway, and click Enable Git Gateway. This will authenticate with GitHub and generate a GitHub API access token. In this case, we’re leaving the Roles field blank, which means any logged in user may access the CMS.

If you set your registration preference to “Invite only,” you’ll need to invite yourself (and anyone else you choose) as a site user. To do this, select the Identity tab from your site dashboard, and then select the Invite users button. Invited users will receive an email invitation with a confirmation link. Clicking the link will take you to your site with a login prompt.

If you left your site registration open, or for return visits after confirming an email invitation, you can access your site’s CMS at "yoursite.com/admin/".

## Accessing Netlify CMS Data

After you've logged in to the CMS, the fields available for posts are dictated by the `public/admin/config.yml` file.
If you'd like to remove any, simply comment out the object. For example, I don't plan on using the thumbnail and rating for each post, so I'll remove (or comment out):
<pre>
- {label: "Featured Image", name: "thumbnail", widget: "image"}
- {label: "Rating (scale of 1-5)", name: "rating", widget: "number"}
</pre>
Then, modify the following code in `static.config.js` to fit the data that the CMS will provide:
<pre>
    klaw('./src/posts')
        .on('data', item => {
          // Filter function to retrieve .md files //
          if (path.extname(item.path) === '.md') {
            // If markdown file, read contents //
            const data = fs.readFileSync(item.path, 'utf8')
            // Convert to frontmatter object and markdown content //
            const dataObj = matter(data)
            dataObj.content = marked(dataObj.content)
            // Create slug for URL //
            dataObj.data.slug = dataObj.data.title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
            // Parse image file name from path //
            dataObj.data.thumbnail = dataObj.data.thumbnail.replace('/public/uploads/', '')
            // Push object into items array //
            items.push(dataObj)
          }
        })
</pre>
(I'd remove the thumbnail property since I removed it in `config.yml`)

In addition, make sure that no files in `src/containers` are relying on the removed data.

When posts are submitted, the file paths are dictated by the `public/admin/config.yml` file.

You should now be up-and-running with React Static and Netlify CMS as a Git-based static site generator!