import React from 'react'
import { withRouteData, Link } from 'react-static'
import Moment from 'react-moment'
import Markdown from 'react-markdown'
//

export default withRouteData(({ post }) => (
  <div className="blog-post">
    <Link to="/blog/">{'<'} Back</Link>
    <br />
    <h3>{post.data.title}</h3>
    <Moment format="MMMM Do, YYYY">{post.data.date}</Moment>
    <img className="image" src={post.data.thumbnail} alt="" />
    <Markdown source={post.content} escapeHtml={false} />
  </div>
))
