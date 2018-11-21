import React from 'react';
import { withRouteData, Link } from 'react-static';
import Moment from 'react-moment';
import Markdown from 'react-markdown';
//

export default withRouteData(({ guide }) => (
  <div className="blog-post">
    <Link to="/blog/">{'<'} Back</Link>
    <br />
    <h3>{guide.data.title}</h3>
    <Moment format="MMMM Do, YYYY">{guide.data.date}</Moment>
    <img className="image" src={guide.data.thumbnail} alt="" />
    <Markdown source={guide.content} escapeHtml={false} />
  </div>
));
