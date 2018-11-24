import React from 'react';
import { withSiteData, Link } from 'react-static';
import Moment from 'react-moment';
import Markdown from 'react-markdown';
//

export default withSiteData(data => {
  const { guide } = data;
  console.log('SITE', data);
  return <div className="blog-post">hello</div>;
});
