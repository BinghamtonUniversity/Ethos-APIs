const app = document.querySelector('#app')
const apiList = document.querySelector('#apiList')
const catalogCount = document.querySelector('#catalogCount')
const clearButton = document.querySelector('#clearButton')
const catalogToggle = document.querySelector('#catalogToggle')
const resultCount = document.querySelector('#resultCount')
const searchInput = document.querySelector('#searchInput')
const shell = document.querySelector('#shell')
const status = document.querySelector('#status')
const maxVisibleResults = 150

let sources = []
let activeSource = null
let renderTimer = null
const familyName = (source) => source.url.split('/')[2] || 'APIs'
const apiKindLabels = {
  BannerBusAPIs: 'Business Process API',
  BannerErpAPIs: 'Banner ERP API',
  BannerEedmAPIs: 'Ethos Data Model API',
}
const sourceVersion = (source) => source.version || source.url.match(/-(\d+\.\d+\.\d+(?:[-\w.]*)?)\//)?.[1] || ''
const oasVersion = (source) => source.oasVersion || ''
const sourceTitle = (source) => {
  const version = sourceVersion(source)
  return version ? source.title.replace(new RegExp(`\\s+${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '') : source.title
}
const normalizeSearchText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
const sourceText = (source) =>
  normalizeSearchText(
    `${source.title} ${sourceVersion(source)} ${oasVersion(source)} ${source.slug} ${source.url} ${familyName(source)} ${
      source.searchText || ''
    }`,
  )
const getUrlSourceSlug = () => new URL(window.location.href).searchParams.get('api')
const getLegacyHashSourceSlug = () => {
  const value = decodeURIComponent(window.location.hash.replace(/^#\/?/, ''))
  return value && !value.includes('/') ? value : ''
}

const findSourceBySlug = (slug) => {
  if (!slug) {
    return null
  }

  const exactSource = sources.find((source) => source.slug === slug)
  if (exactSource) {
    return exactSource
  }

  const suffix = slug.replace(/^[^-]+-/, '')
  const suffixMatches = sources.filter((source) => source.slug.endsWith(suffix))
  return suffixMatches.length === 1 ? suffixMatches[0] : null
}

const updateUrlSource = (source) => {
  const url = new URL(window.location.href)
  url.searchParams.set('api', source.slug)
  url.hash = ''
  window.history.replaceState(null, '', url)
}

const setCatalogCollapsed = (collapsed) => {
  shell.dataset.catalogCollapsed = String(collapsed)
  catalogToggle.textContent = collapsed ? '>' : 'Hide'
  catalogToggle.setAttribute('aria-expanded', String(!collapsed))
  window.localStorage.setItem('experience-sdk-catalog-collapsed', String(collapsed))
}

setCatalogCollapsed(window.localStorage.getItem('experience-sdk-catalog-collapsed') === 'true')

const setStatus = (message, state = '') => {
  status.hidden = !message
  status.dataset.state = state
  status.textContent = message
}

const parseSearchTerms = (value) => {
  const terms = []
  const normalizedValue = String(value || '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
  const pattern = /"([^"]+)"|'([^']+)'|(\S+)/g
  let match = pattern.exec(normalizedValue)

  while (match) {
    const term = normalizeSearchText(match[1] || match[2] || match[3])

    if (term) {
      terms.push(term)
    }

    match = pattern.exec(value)
  }

  return terms
}

const matchSources = () => {
  const terms = parseSearchTerms(searchInput.value)

  if (!terms.length) {
    return sources
  }

  return sources.filter((source) => {
    const haystack = sourceText(source)
    return terms.every((term) => haystack.includes(term))
  })
}

const renderList = () => {
  const matches = matchSources()
  const visible = matches.slice(0, maxVisibleResults)
  const suffix = matches.length > visible.length ? `, showing first ${visible.length}` : ''

  resultCount.textContent = `${matches.length.toLocaleString()} result${matches.length === 1 ? '' : 's'}${suffix}`
  apiList.replaceChildren(
    ...visible.map((source) => {
      const button = document.createElement('button')
      const title = document.createElement('span')
      const meta = document.createElement('span')
      const path = document.createElement('span')
      const version = sourceVersion(source)
      const openApiVersion = oasVersion(source)

      button.className = 'api-button'
      button.type = 'button'
      button.setAttribute('aria-current', activeSource?.slug === source.slug ? 'true' : 'false')
      button.addEventListener('click', () => selectSource(source, true))

      title.className = 'api-title'
      title.textContent = sourceTitle(source)
      meta.className = 'api-meta'
      meta.textContent = [version && `v${version}`, openApiVersion && `OAS ${openApiVersion}`].filter(Boolean).join(' | ')
      path.className = 'api-path'
      path.textContent = source.url.replace('./ethosapis/', '')

      button.append(title, meta, path)
      return button
    }),
  )
}

const scheduleRenderList = () => {
  window.clearTimeout(renderTimer)
  renderTimer = window.setTimeout(renderList, 80)
}

const addApiKindBadge = (source) => {
  const family = familyName(source)
  const badge = document.createElement('div')
  badge.className = 'api-kind-badge'
  badge.dataset.family = family
  badge.textContent = apiKindLabels[family] || family
  app.append(badge)
}

const getElements = (root) =>
  [...root.querySelectorAll('*')].flatMap((element) => [element, ...(element.shadowRoot ? getElements(element.shadowRoot) : [])])

const addApiTitleSpacing = (source) => {
  const title = sourceTitle(source).toLowerCase()
  const heading = getElements(app)
    .filter((element) => element.textContent?.trim().toLowerCase().includes(title))
    .sort((first, second) => {
      const firstSize = Number.parseFloat(window.getComputedStyle(first).fontSize) || 0
      const secondSize = Number.parseFloat(window.getComputedStyle(second).fontSize) || 0
      return secondSize - firstSize
    })[0]

  if (heading) {
    heading.style.setProperty('margin-top', '18px', 'important')
    heading.style.setProperty('display', 'block', 'important')
  }
}

const watchApiTitleSpacing = (source) => {
  addApiTitleSpacing(source)

  const observer = new MutationObserver(() => addApiTitleSpacing(source))
  observer.observe(app, { childList: true, subtree: true })
  window.setTimeout(() => observer.disconnect(), 5000)
}

const selectSource = (source, updateUrl) => {
  if (!source || activeSource?.slug === source.slug) {
    return
  }

  activeSource = source
  setStatus(`Loading ${sourceTitle(source)}...`)
  app.replaceChildren()

  if (updateUrl) {
    updateUrlSource(source)
  }

  Scalar.createApiReference('#app', {
    url: source.url,
    agent: {
      disabled: true,
    },
    customCss: `
      .dark-mode {
        --scalar-background-1: #141414;
        --scalar-background-2: #1a1a1a;
        --scalar-background-3: #272727;
        --scalar-color-1: #e7e7e7;
        --scalar-color-2: #c7c7c7;
        --scalar-color-3: #797979;
        --scalar-color-accent: #00aeff;
        --scalar-background-accent: #3ea6ff1f;
        --scalar-border-color: #2d2d2d;
      }

      .dark-mode .sidebar {
        --scalar-sidebar-background-1: #141414;
      }

      .dark-mode .scalar-app {
        background: #141414 !important;
      }

      button[aria-label*="Ask AI" i],
      button[aria-label*="Agent" i],
      button[aria-label*="MCP" i],
      button[aria-label*="Cursor" i],
      button[aria-label*="VS Code" i],
      button.show-api-client-button,
      a[aria-label*="MCP" i],
      a[aria-label*="Cursor" i],
      a[aria-label*="VS Code" i],
      a[href*="scalar.com"] {
        display: none !important;
      }
    `,
    defaultHttpClient: {
      targetKey: 'shell',
      clientKey: 'curl',
    },
    darkMode: true,
    documentDownloadType: 'yaml',
    hideDarkModeToggle: true,
    layout: 'modern',
    mcp: {
      disabled: true,
    },
    persistAuth: true,
    proxyUrl: 'https://proxy.scalar.com',
    searchHotKey: 'k',
    showDeveloperTools: 'never',
    showSidebar: true,
    telemetry: false,
    theme: 'none',
  })

  addApiKindBadge(source)

  const removeScalarChrome = () => {
    getElements(app).forEach((element) => {
      if (!['A', 'BUTTON'].includes(element.tagName)) {
        return
      }

      const text = element.textContent?.trim().toLowerCase() || ''
      const label = element.getAttribute('aria-label')?.toLowerCase() || ''
      const href = element.getAttribute('href')?.toLowerCase() || ''

      if (
        element.classList.contains('show-api-client-button') ||
        text.includes('powered by scalar') ||
        text.includes('generate mcp') ||
        text.includes('test request') ||
        text === 'cursor' ||
        text === 'vs code' ||
        text === 'ask ai' ||
        label.includes('ask ai') ||
        label.includes('agent') ||
        label.includes('mcp') ||
        label.includes('cursor') ||
        label.includes('vs code') ||
        href.includes('scalar.com')
      ) {
        element.remove()
      }
    })
  }

  const watchScalarChrome = () => {
    const observer = new MutationObserver(removeScalarChrome)
    observer.observe(app, { childList: true, subtree: true })
    window.setTimeout(() => observer.disconnect(), 10000)
  }

  removeScalarChrome()
  watchScalarChrome()
  watchApiTitleSpacing(source)
  window.setTimeout(removeScalarChrome, 500)
  window.setTimeout(removeScalarChrome, 1500)
  window.setTimeout(removeScalarChrome, 5000)

  setStatus('')
  renderList()
}

searchInput.addEventListener('input', scheduleRenderList)
catalogToggle.addEventListener('click', () => {
  setCatalogCollapsed(shell.dataset.catalogCollapsed !== 'true')
})
clearButton.addEventListener('click', () => {
  searchInput.value = ''
  searchInput.focus()
  renderList()
})

const fetchJson = (url) =>
  fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`${url} request failed with ${response.status}`)
    }

    return response.json()
  })

fetchJson('./scalar-manifest.json')
  .then((manifest) => {
    if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
      throw new Error('No API sources were found in scalar-manifest.json')
    }

    sources = manifest.sources.map((source) => ({ ...source, searchText: '' }))
    catalogCount.textContent = `${sources.length.toLocaleString()} APIs, loading YAML search...`
    renderList()

    const urlSource = findSourceBySlug(getUrlSourceSlug())
    const legacyHashSource = findSourceBySlug(getLegacyHashSourceSlug())
    const selectedSource = urlSource || legacyHashSource

    if (selectedSource) {
      selectSource(selectedSource, Boolean(legacyHashSource))
    } else {
      setStatus('')
    }

    return fetchJson('./scalar-search-index.json')
      .then((searchIndex) => {
        const searchTextBySlug = new Map((searchIndex.items || []).map((item) => [item.slug, item.text]))
        sources = sources.map((source) => ({
          ...source,
          searchText: searchTextBySlug.get(source.slug) || '',
        }))
        catalogCount.textContent = `${sources.length.toLocaleString()} APIs,  Search ${
          searchTextBySlug.size ? 'ready' : 'unavailable'
        }`
        renderList()
      })
      .catch(() => {
        catalogCount.textContent = `${sources.length.toLocaleString()} APIs,  Search unavailable`
      })
  })
  .catch((error) => {
    catalogCount.textContent = 'Catalog failed to load'
    setStatus(
      `Could not load the API catalog. Start a local web server from this folder and make sure scalar-manifest.json exists. ${error.message}`,
      'error',
    )
  })
