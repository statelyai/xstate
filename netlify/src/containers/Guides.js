import React from 'react';
import { withRouteData, Link } from 'react-static';
import Sidebar from './Sidebar';
//

export default withRouteData(data => {
  console.log(data);
  return (
    <div>
      <Sidebar />
      <br />
      All Gduides:
      <ul>
        {data.guides.map(post => (
          <li key={post.data.slug}>
            <Link to={`/guides/${post.data.slug}`}>{post.data.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
});
