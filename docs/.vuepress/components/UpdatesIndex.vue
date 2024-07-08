<template>
<ul>
  <li v-for="(post, index) in posts" :key="index" :class="post.frontmatter.updateType">
    <p>{{ new Date(post.frontmatter.date).toLocaleString('en-US',{ month:'long', day:'numeric', year:'numeric' }) }}</p>
    <h2>
      <router-link :to="post.path">{{ post.frontmatter.title }}</router-link>
    </h2>
    <p>{{ post.frontmatter.description }}</p>
  </li>
</ul>
</template>

<script>
export default {
  computed: {
    posts() {
      return this.$site.pages
        // gets the pages in the updates section, excluding any page with updatesIndex: true in the frontmatter
        .filter(x => x.path.startsWith('/updates/') && !x.frontmatter.updatesIndex)
        // sort by newest to oldest
        .sort((a, b) => new Date(b.frontmatter.date) - new Date(a.frontmatter.date));
    }
  }
}
</script>

<style scoped>
  ul {
    list-style-type: none;
    padding: 0;
  }

  ul li {
    margin-top: 3rem;
  }

  .platform {
    border: 0.1rem solid blue;
  }
</style>