import React from 'react';
import { withRouteData, Link } from 'react-static';
//

export default withRouteData(({ guides }) => (
  <div>
    <br />
    All Guides:
    <ul>
      {guides.map(post => (
        <li key={post.data.slug}>
          <Link to={`/guides/${post.data.slug}`}>{post.data.title}</Link>
        </li>
      ))}
    </ul>
  </div>
));
