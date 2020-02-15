<template>
  <form
    id="search-form"
    class="algolia-search-wrapper search-box"
    role="search"
  >
    <input
      id="algolia-search-input"
      class="search-query"
    >
  </form>
</template>

<script>
export default {
  props: ['options'],
  mounted () {
    this.initialize(this.options, this.$lang)
  },
  methods: {
    initialize (userOptions, lang) {
      Promise.all([
        import(/* webpackChunkName: "docsearch" */ 'docsearch.js/dist/cdn/docsearch.min.js'),
        import(/* webpackChunkName: "docsearch" */ 'docsearch.js/dist/cdn/docsearch.min.css')
      ]).then(([docsearch]) => {
        docsearch = docsearch.default
        const { algoliaOptions = {}} = userOptions
        docsearch(Object.assign(
          {},
          userOptions,
          {
            inputSelector: '#algolia-search-input',
            // #697 Make docsearch work well at i18n mode.
            algoliaOptions: Object.assign({
              'facetFilters': [`lang:${lang}`].concat(algoliaOptions.facetFilters || [])
            }, algoliaOptions),
            handleSelected: (input, event, suggestion) => {
              // MODIFICATION_FROM_THEME - old
              // this.$router.push(new URL(suggestion.url).pathname)
              // issue: this will redirect the page with duplicate site base
              // MODIFICATION_FROM_THEME - new
              let { pathname, hash } = new URL(suggestion.url)
              const baseUrl = this.$site.base;
              if (baseUrl && pathname.substr(0, baseUrl.length) === baseUrl) {
                pathname = pathname.substr(baseUrl.length - 1)
              }
              this.$router.push(`${pathname}${hash}`)
              // MODIFICATION_FROM_THEME - end
            }
          }
        ))
      })
    },
    update (options, lang) {
      this.$el.innerHTML = '<input id="algolia-search-input" class="search-query">dddd'
      this.initialize(options, lang)
    }
  },
  watch: {
    $lang (newValue) {
      this.update(this.options, newValue)
    },
    options (newValue) {
      this.update(newValue, this.$lang)
    }
  }
}
</script>

<style lang="stylus">
.algolia-search-wrapper
  & > span
    vertical-align middle
  .algolia-autocomplete
    line-height normal
    .ds-dropdown-menu
      background-color #fff
      border 1px solid #999
      border-radius 4px
      font-size 16px
      margin 6px 0 0
      padding 4px
      text-align left
      &:before
        border-color #999
      [class*=ds-dataset-]
        border none
        padding 0
      .ds-suggestions
        margin-top 0
      .ds-suggestion
        border-bottom 1px solid $borderColor
    .algolia-docsearch-suggestion--highlight
      color #2c815b
    .algolia-docsearch-suggestion
      border-color $borderColor
      padding 0
      .algolia-docsearch-suggestion--category-header
        padding 5px 10px
        margin-top 0
        background $accentColor
        color #fff
        font-weight 600
        .algolia-docsearch-suggestion--highlight
          background rgba(255, 255, 255, 0.6)
      .algolia-docsearch-suggestion--wrapper
        padding 0
      .algolia-docsearch-suggestion--title
        font-weight 600
        margin-bottom 0
        color $textColor
      .algolia-docsearch-suggestion--subcategory-column
        vertical-align top
        padding 5px 7px 5px 5px
        border-color $borderColor
        background #f1f3f5
        &:after
          display none
      .algolia-docsearch-suggestion--subcategory-column-text
        color #555
    .algolia-docsearch-footer
      border-color $borderColor
    .ds-cursor .algolia-docsearch-suggestion--content
      background-color #e7edf3 !important
      color $textColor
@media (min-width: $MQMobile)
  .algolia-search-wrapper
    .algolia-autocomplete
      .algolia-docsearch-suggestion
        .algolia-docsearch-suggestion--subcategory-column
          float none
          width 150px
          min-width 150px
          display table-cell
        .algolia-docsearch-suggestion--content
          float none
          display table-cell
          width 100%
          vertical-align top
        .ds-dropdown-menu
          min-width 515px !important
@media (max-width: $MQMobile)
  .algolia-search-wrapper
    .ds-dropdown-menu
      min-width calc(100vw - 4rem) !important
      max-width calc(100vw - 4rem) !important
    .algolia-docsearch-suggestion--wrapper
      padding 5px 7px 5px 5px !important
    .algolia-docsearch-suggestion--subcategory-column
      padding 0 !important
      background white !important
    .algolia-docsearch-suggestion--subcategory-column-text:after
      content " > "
      font-size 10px
      line-height 14.4px
      display inline-block
      width 5px
      margin -3px 3px 0
      vertical-align middle
</style>