import { useEffect, useMemo, useState } from 'react'
import {
  FaArrowLeft,
  FaArrowRight,
  FaDiscord,
  FaHeart,
  FaInstagram,
  FaRegHeart,
  FaShareAlt,
  FaTimes,
} from 'react-icons/fa'
import { SiRoblox } from 'react-icons/si'
import { AdminAccessPanel } from './components/AdminAccessPanel'
import { globalAdminAccessConfig } from './constants/globalAdminAccessConfig'
import { globalArticlePublicationController } from './controllers/articles/globalArticlePublicationController'
import {
  applyGlobalBackgroundHexColor,
  loadPersistedGlobalBackgroundHexColor,
} from './services/globalBackgroundPreferencesService'
import { submitContactMessageUsingGateway } from './services/contactSubmissionService'

const globalInternalContactGatewayClient = {
  async sendContactMessage(sanitizedContactPayload) {
    return {
      statusCode: 201,
      payload: {
        message: `Mensagem recebida com sucesso de ${sanitizedContactPayload.fullName}.`,
      },
    }
  },
}

const globalCuratedSocialLinks = [
  {
    id: 'discord',
    channelName: 'Discord',
    url: 'https://discord.com',
    iconComponent: FaDiscord,
  },
  {
    id: 'instagram',
    channelName: 'Instagram',
    url: 'https://www.instagram.com',
    iconComponent: FaInstagram,
  },
  {
    id: 'robloxStore',
    channelName: 'Roblox Store',
    url: 'https://www.roblox.com/catalog',
    iconComponent: SiRoblox,
  },
]

function App() {
  const [currentRouteHash, setCurrentRouteHash] = useState(() => window.location.hash || globalAdminAccessConfig.landingRouteHash)
  const [managedArticleCatalog, setManagedArticleCatalog] = useState(() => {
    return globalArticlePublicationController.listAllArticleCatalog().articleCatalog
  })
  const [selectedProjectIdentifier, setSelectedProjectIdentifier] = useState(null)
  const [currentGalleryImageIndex, setCurrentGalleryImageIndex] = useState(0)
  const [likedProjectIdentifierSet, setLikedProjectIdentifierSet] = useState(new Set())
  const [projectLikeCountByIdentifier, setProjectLikeCountByIdentifier] = useState(() => {
    return Object.fromEntries(
      globalArticlePublicationController
        .listAllArticleCatalog()
        .articleCatalog
        .map((projectData) => [projectData.id, projectData.likeCount])
    )
  })
  const [contactFormState, setContactFormState] = useState({
    fullName: '',
    emailAddress: '',
    messageBody: '',
  })
  const [contactSubmissionFeedbackMessage, setContactSubmissionFeedbackMessage] = useState('')

  const publishedArticleCatalog = useMemo(() => {
    return managedArticleCatalog.filter((articleData) => articleData.isPublished)
  }, [managedArticleCatalog])

  const selectedProjectData = useMemo(() => {
    return publishedArticleCatalog.find((projectData) => projectData.id === selectedProjectIdentifier)
  }, [publishedArticleCatalog, selectedProjectIdentifier])
  const selectedProjectGalleryImageCount = selectedProjectData?.galleryImageUrls.length ?? 0
  const hasSelectedProjectBeenLiked = selectedProjectData ? likedProjectIdentifierSet.has(selectedProjectData.id) : false
  const isAdminRouteActive = currentRouteHash === globalAdminAccessConfig.adminRouteHash

  useEffect(() => {
    function handleHashRouteChange() {
      setCurrentRouteHash(window.location.hash || globalAdminAccessConfig.landingRouteHash)
    }

    window.addEventListener('hashchange', handleHashRouteChange)

    return () => {
      window.removeEventListener('hashchange', handleHashRouteChange)
    }
  }, [])

  useEffect(() => {
    const persistedBackgroundHexColor = loadPersistedGlobalBackgroundHexColor()
    applyGlobalBackgroundHexColor(persistedBackgroundHexColor)
  }, [])

  useEffect(() => {
    setProjectLikeCountByIdentifier((currentProjectLikeCountByIdentifier) => {
      const nextProjectLikeCountByIdentifier = { ...currentProjectLikeCountByIdentifier }

      managedArticleCatalog.forEach((projectData) => {
        if (typeof nextProjectLikeCountByIdentifier[projectData.id] !== 'number') {
          nextProjectLikeCountByIdentifier[projectData.id] = projectData.likeCount
        }
      })

      return nextProjectLikeCountByIdentifier
    })
  }, [managedArticleCatalog])

  useEffect(() => {
    if (!selectedProjectData) {
      return undefined
    }

    function handleEscapeKeyDown(event) {
      if (event.key === 'Escape') {
        setSelectedProjectIdentifier(null)
      }
    }

    window.addEventListener('keydown', handleEscapeKeyDown)

    return () => {
      window.removeEventListener('keydown', handleEscapeKeyDown)
    }
  }, [selectedProjectData])

  useEffect(() => {
    if (!selectedProjectData) {
      return
    }

    const maxIndex = selectedProjectData.galleryImageUrls.length - 1
    if (currentGalleryImageIndex > maxIndex) {
      setCurrentGalleryImageIndex(0)
    }
  }, [currentGalleryImageIndex, selectedProjectData])

  function handleProjectLikeClick(projectIdentifier) {
    const hasProjectAlreadyBeenLikedInCurrentSession = likedProjectIdentifierSet.has(projectIdentifier)

    setProjectLikeCountByIdentifier((currentProjectLikeCountByIdentifier) => {
      const currentCount = currentProjectLikeCountByIdentifier[projectIdentifier] ?? 0
      const nextCount = hasProjectAlreadyBeenLikedInCurrentSession
        ? Math.max(0, currentCount - 1)
        : currentCount + 1
      return { ...currentProjectLikeCountByIdentifier, [projectIdentifier]: nextCount }
    })

    setLikedProjectIdentifierSet((currentLikedProjectIdentifierSet) => {
      const nextLikedProjectIdentifierSet = new Set(currentLikedProjectIdentifierSet)
      if (hasProjectAlreadyBeenLikedInCurrentSession) {
        nextLikedProjectIdentifierSet.delete(projectIdentifier)
      } else {
        nextLikedProjectIdentifierSet.add(projectIdentifier)
      }
      return nextLikedProjectIdentifierSet
    })
  }

  function handleContactInputChange(event) {
    const changedInputName = event.target.name
    const changedInputValue = event.target.value
    setContactFormState((currentContactFormState) => ({
      ...currentContactFormState,
      [changedInputName]: changedInputValue,
    }))
  }

  async function handleContactFormSubmission(event) {
    event.preventDefault()

    const contactServiceResponse = await submitContactMessageUsingGateway(
      contactFormState,
      globalInternalContactGatewayClient,
      'landing-contact-flow'
    )

    setContactSubmissionFeedbackMessage(contactServiceResponse.publicMessage)

    if (contactServiceResponse.statusCode === 201) {
      setContactFormState({ fullName: '', emailAddress: '', messageBody: '' })
    }
  }

  function handleOpenProjectModal(projectIdentifier) {
    setSelectedProjectIdentifier(projectIdentifier)
    setCurrentGalleryImageIndex(0)
  }

  function handleNavigateGalleryLeft() {
    if (!selectedProjectData || selectedProjectGalleryImageCount === 0) return

    setCurrentGalleryImageIndex((currentIndex) => {
      const hasPreviousImage = currentIndex > 0
      return hasPreviousImage ? currentIndex - 1 : selectedProjectGalleryImageCount - 1
    })
  }

  function handleNavigateGalleryRight() {
    if (!selectedProjectData || selectedProjectGalleryImageCount === 0) return

    setCurrentGalleryImageIndex((currentIndex) => {
      const isLastImage = currentIndex >= selectedProjectGalleryImageCount - 1
      return isLastImage ? 0 : currentIndex + 1
    })
  }

  function handleShareProjectClick() {
    alert('Link do projeto copiado para compartilhar!')
  }

  function handleModalOverlayClick(event) {
    if (event.target === event.currentTarget) {
      setSelectedProjectIdentifier(null)
    }
  }

  const featuredProjectData = publishedArticleCatalog[0]

  if (isAdminRouteActive) {
    return (
      <AdminAccessPanel
        articlePublicationController={globalArticlePublicationController}
        onArticleCatalogChange={setManagedArticleCatalog}
        onNavigateBackToLanding={() => {
          window.location.hash = globalAdminAccessConfig.landingRouteHash
        }}
      />
    )
  }

  return (
    <div className="w-full">
      <header className="cute-box relative mx-auto w-full max-w-7xl overflow-hidden bg-pastelPink px-4 py-8 sm:px-8 lg:px-12 lg:py-12 mb-16">
        <nav className="relative z-20 flex w-full flex-wrap items-center justify-center gap-6">
          <ul className="flex items-center gap-4 text-sm font-bold uppercase text-inkBlack sm:gap-6">
            <li><a href="#home" className="transition-transform hover:-translate-y-1">Início</a></li>
            <li><a href="#assetsHeading" className="transition-transform hover:-translate-y-1">3D Assets</a></li>
            <li><a href="#contatoHeading" className="transition-transform hover:-translate-y-1">Contato</a></li>
          </ul>
        </nav>

        <section id="home" className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:px-12 lg:py-16 flex flex-col items-center text-center">
          <article className="space-y-16">         
            <div className="mx-auto flex items-center justify-center gap-4 text-sm font-bold uppercase text-inkBlack sm:gap-6">
              <h1 className="text-4xl font-display text-inkBlack drop-shadow-[2px_2px_0px_#ffffff] sm:text-5xl lg:text-6xl">
                Candy Lab Studios
              </h1>
            </div>

            <div className="cute-box mx-auto inline-block bg-pastelYellow px-6 py-2 text-xs font-black uppercase text-inkBlack">
              Assets 3D para Roblox
            </div>

            <p className="mx-auto max-w-2xl text-base font-bold text-inkBlack/80 px-4 border-t-4 border-b-4 border-inkBlack py-4">
              Produção de assets 3D e itens UGC para Roblox.
            </p>
          </article>

          <article className="relative mx-auto mt-16 mb-8 w-full max-w-2xl px-6">
            {featuredProjectData ? (
             <div
                className="cute-box relative mx-auto w-full aspect-4/3 max-w-150 overflow-hidden bg-pastelBlue p-0 border-4 border-white shadow-xl cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => handleOpenProjectModal(featuredProjectData.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleOpenProjectModal(featuredProjectData.id)
                  }
                }}
                aria-label={`Abrir modal do projeto em destaque ${featuredProjectData.title}`}
             >
                <img
                  src={featuredProjectData.imageUrl}
                  alt={featuredProjectData.imageAlternativeText}
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                />
                
                <div className="cute-box absolute bottom-5 left-5 bg-paperWhite px-5 py-3">
                   <h3 className="text-xl font-display text-inkBlack drop-shadow-[1px_1px_0px_#ffffff]">{featuredProjectData.title}</h3>
                   <p className="text-xs font-bold uppercase text-inkBlack/70">UGC / Props</p>
                </div>
                
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); handleOpenProjectModal(featuredProjectData.id) }}
                  className="cute-button absolute right-5 top-5 flex h-14 w-14 items-center justify-center p-0! rounded-full! bg-pastelPink text-xl border-2 border-white"
                  aria-label={`Abrir detalhes de destaque do projeto ${featuredProjectData.title}`}
                ><span className="leading-none">+</span></button>
             </div>
            ) : (
              <div className="cute-box mx-auto bg-paperWhite p-8 text-center">
                <p className="text-sm font-black uppercase tracking-wider text-inkBlack/70">
                  Nenhum artigo publicado no momento.
                </p>
              </div>
            )}
          </article>
        </section>
      </header>

      <main className="mt-16 space-y-16 sm:mt-12">
        <div id="assetsHeading" className="flex justify-center mb-12">
          <div className="text-center bg-paperWhite cute-box inline-block px-10 py-6">
            <h2 id="portfolioSectionHeading" className="text-4xl sm:text-5xl font-display text-inkBlack drop-shadow-[2px_2px_0px_#ffffff]">3D Assets</h2>
            <p className="mt-3 text-sm font-black tracking-widest uppercase text-inkBlack/80">Projetos UGC em destaque</p>
          </div>
        </div>
        <section id="portfolio" aria-labelledby="portfolioSectionHeading" className="cute-box mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:px-12 lg:py-12 bg-pastelBlue mb-16 border-4 border-white">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {publishedArticleCatalog.map((projectData) => (
              <article key={projectData.id} className="group flex flex-col items-center">
                <button
                  type="button"
                  className="cute-box relative flex w-full flex-col items-center overflow-hidden bg-paperWhite p-4 text-center border-2 hover:border-pastelPink transition-colors"
                  onClick={() => handleOpenProjectModal(projectData.id)}
                  aria-label={`Abrir detalhes do projeto ${projectData.title}`}
                >
                  <div className="cute-box relative h-56 w-full overflow-hidden bg-pastelPink shadow-none p-0!">
                    <img
                      src={projectData.imageUrl}
                      alt={projectData.imageAlternativeText}
                      className="h-full w-full object-cover filter saturate-150 transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="cute-box absolute -right-2 top-4 flex h-14 w-14 items-center justify-center rounded-full bg-pastelYellow shadow-none text-sm font-black uppercase text-inkBlack -rotate-12 border-2 border-white p-0!">
                      <span className="flex items-center gap-1">
                        {projectLikeCountByIdentifier[projectData.id]}
                        <FaHeart aria-hidden="true" />
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 mb-2 space-y-2">
                    <h3 className="text-2xl font-display text-inkBlack drop-shadow-[1px_1px_0px_#ffffff]">{projectData.title}</h3>
                    <p className="mx-auto text-xs font-bold uppercase tracking-wider text-inkBlack/70">
                      {projectData.subtitle}
                    </p>
                    <span className="cute-box mt-4 inline-block bg-paperWhite text-inkBlack px-6 py-2 text-xs font-black uppercase tracking-wider shadow-none transition-all group-hover:bg-pastelYellow group-hover:text-inkBlack group-hover:shadow-[3px_3px_0px_0px_#111111] group-focus-visible:bg-pastelYellow group-focus-visible:text-inkBlack group-focus-visible:shadow-[3px_3px_0px_0px_#111111]">
                      Ver detalhes
                    </span>
                  </div>
                </button>
              </article>
            ))}
          </div>
        </section>

        <div id="contatoHeading" className="flex justify-center mb-12">
          <div className="text-center bg-paperWhite cute-box inline-block px-10 py-6">
            <h2 className="text-4xl sm:text-5xl font-display text-inkBlack drop-shadow-[2px_2px_0px_#ffffff]">Contato</h2>
          </div>
        </div>

        <section aria-labelledby="socialSectionHeading" className="cute-box mx-auto grid max-w-7xl px-4 py-8 sm:px-8 lg:px-12 lg:py-12 gap-10 bg-pastelYellow lg:grid-cols-2">
          
          <article className="flex flex-col justify-center space-y-8">
            <div>
              <h2 id="socialSectionHeading" className="text-4xl font-display text-inkBlack drop-shadow-[2px_2px_0px_#ffffff]">Pronto para o próximo asset 3D?</h2>
            </div>
            <p className="text-base font-bold leading-relaxed text-inkBlack/80">
              Parcerias para criação de assets, itens UGC e direção visual para builds no Roblox.
            </p>

            <ul className="flex flex-wrap gap-4">
              {globalCuratedSocialLinks.map((socialChannelData) => (
                <li key={socialChannelData.id}>
                  <a
                    href={socialChannelData.url}
                    target="_blank"
                    rel="noreferrer"
                    className="cute-box flex items-center gap-3 bg-paperWhite px-6 py-3 font-bold text-inkBlack hover:bg-pastelPink hover:text-inkBlack transition-colors"
                  >
                    <span aria-hidden="true">
                      <socialChannelData.iconComponent size={18} />
                    </span>
                    <span>{socialChannelData.channelName}</span>
                  </a>
                </li>
              ))}
            </ul>
          </article>

          <article className="cute-box bg-pastelPink p-6 sm:p-8 shadow-none border-[6px] border-white">
            <h3 className="text-3xl font-display text-inkBlack drop-shadow-[2px_2px_0px_#ffffff]">Contact</h3>
            <form className="mt-8 flex flex-col space-y-5" onSubmit={handleContactFormSubmission}>
              <label className="block text-xs font-black uppercase tracking-wider text-inkBlack">
                Full Name
                <input
                  name="fullName"
                  type="text"
                  value={contactFormState.fullName}
                  onChange={handleContactInputChange}
                  required
                  className="cute-input mt-2 w-full border-2 border-dashed"
                  placeholder="Name"
                />
              </label>
              <label className="block text-xs font-black uppercase tracking-wider text-inkBlack">
                E-mail
                <input
                  name="emailAddress"
                  type="email"
                  value={contactFormState.emailAddress}
                  onChange={handleContactInputChange}
                  required
                  className="cute-input mt-2 w-full border-2 border-dashed"
                  placeholder="contat@exemple.com"
                />
              </label>
              <label className="block text-xs font-black uppercase tracking-wider text-inkBlack">
                Details
                <textarea
                  name="messageBody"
                  rows="3"
                  value={contactFormState.messageBody}
                  onChange={handleContactInputChange}
                  required
                  className="cute-input mt-2 w-full resize-none border-2 border-dashed"
                  placeholder="Message Text"
                />
              </label>
              <button type="submit" className="cute-button mt-4 flex w-full items-center justify-center gap-2 bg-pastelYellow">
                <FaShareAlt aria-hidden="true" />
                <span>Send</span>
              </button>
              {contactSubmissionFeedbackMessage ? (
                <p className="cute-box mt-4 bg-paperWhite py-3 text-center text-sm font-black shadow-none" role="status">
                  {contactSubmissionFeedbackMessage}
                </p>
              ) : null}
            </form>
          </article>
        </section>
      </main>

      <footer className="mt-16 flex flex-col items-center gap-4 pb-10">
        <span className="cute-box mx-auto block w-full max-w-7xl px-4 py-2 text-center text-xs font-black uppercase tracking-wider shadow-none sm:px-8 lg:px-12">© 2026 Candy Lab Studios</span>
        <a
          href={globalAdminAccessConfig.adminRouteHash}
          className="text-[10px] font-bold uppercase tracking-widest text-inkBlack/60 hover:text-inkBlack"
          aria-label="Acessar painel administrativo privado"
        >
          Acesso privado
        </a>
      </footer>

      {selectedProjectData ? (
        <section
          aria-label="Detalhes do projeto"
          className="fixed inset-0 z-50 flex items-center justify-center bg-inkBlack/80 px-4 py-6 backdrop-blur-sm"
          onClick={handleModalOverlayClick}
        >
          <article
            className="cute-box relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-auto bg-pastelMint p-6 border-[6px] border-white"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="cute-control-button cute-control-button-close absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center text-xl font-black"
              onClick={() => setSelectedProjectIdentifier(null)}
              aria-label="Fechar modal"
            >
              <FaTimes aria-hidden="true" />
            </button>

            <div className="relative flex w-full flex-col items-center justify-center gap-4 bg-white cute-box p-6">
              <div className="relative w-full max-w-5xl aspect-4/3 overflow-hidden bg-pastelBlue cute-box p-0!">
                  <img
                    src={selectedProjectData.galleryImageUrls[currentGalleryImageIndex]}
                    alt={selectedProjectData.imageAlternativeText}
                    className="h-full w-full object-cover saturate-150 transition-all duration-300"
                    loading="lazy"
                  />
                  {selectedProjectGalleryImageCount > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={handleNavigateGalleryLeft}
                        className="cute-control-button absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center border-2 border-white bg-pastelYellow hover:bg-[#f5d060]"
                        aria-label="Imagem anterior"
                      >
                        <FaArrowLeft aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNavigateGalleryRight}
                        className="cute-control-button absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center border-2 border-white bg-pastelYellow hover:bg-[#f5d060]"
                        aria-label="Próxima imagem"
                      >
                        <FaArrowRight aria-hidden="true" />
                      </button>
                    </>
                  )}
              </div>
              <div className="flex gap-2 justify-center mt-2">
                 {selectedProjectData.galleryImageUrls.map((url, index) => (
                    <button
                     type="button"
                      key={url}
                      onClick={() => setCurrentGalleryImageIndex(index)}
                      className={`h-3 w-3 rounded-full border-2 border-inkBlack ${index === currentGalleryImageIndex ? 'bg-pastelPink scale-125' : 'bg-white'}`}
                      aria-label={`Ir para a imagem ${index + 1}`}
                    />
                 ))}
              </div>
            </div>

            <div className="mt-8 flex w-full flex-col justify-center space-y-6">
              <div>
                 <h2 className="text-5xl font-display text-inkBlack drop-shadow-[2px_2px_0px_#ffffff] mb-2">
                    {selectedProjectData.title}
                 </h2>
                 <span className="cute-box mt-2 inline-block bg-paperWhite px-3 py-1 text-xs font-black uppercase shadow-none border-2 border-inkBlack">
                   {selectedProjectData.subtitle}
                 </span>
              </div>
              <p className="text-base font-bold leading-relaxed text-inkBlack/80 bg-pastelYellow p-6 cute-box shadow-none border-4 border-white">
                {selectedProjectData.description}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => handleProjectLikeClick(selectedProjectData.id)}
                  className={`cute-control-button flex h-12 w-12 items-center justify-center border-2 border-inkBlack text-2xl ${
                    hasSelectedProjectBeenLiked
                      ? 'bg-pastelPink hover:bg-[#f09490]'
                      : 'bg-paperWhite! hover:bg-pastelBlue!'
                  }`}
                  aria-label={hasSelectedProjectBeenLiked ? 'Remover curtida' : 'Curtir'}
                >
                  {hasSelectedProjectBeenLiked ? <FaHeart className="text-red-600" aria-hidden="true" /> : <FaRegHeart className="text-inkBlack" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={handleShareProjectClick}
                  className="cute-button cute-button-share flex h-12 flex-1 items-center justify-center gap-2 border-2 border-inkBlack text-inkBlack"
                >
                  <FaShareAlt aria-hidden="true" />
                  <span>Compartilhar</span>
                </button>
              </div>
              <p className="text-xs font-black uppercase tracking-wider text-inkBlack/70">
                Curtidas: {projectLikeCountByIdentifier[selectedProjectData.id]}
              </p>
            </div>
          </article>
        </section>
      ) : null}
    </div>
  )
}

export default App