// Shared with the web dictionaries: defaults never carry UI strings in code.
const en = {
  pageTitle: 'Home',
  pageSlug: 'home',
  name: 'Your name',
  title: 'Your professional title',
  subtitle: 'Tell visitors a little about yourself.',
  heading: 'A heading',
  text: 'Write your story here.',
  alt: 'Describe this image',
  caption: 'An image caption',
  button: 'Learn more',
};
const ptBR: typeof en = {
  pageTitle: 'Início',
  pageSlug: 'inicio',
  name: 'Seu nome',
  title: 'Seu título profissional',
  subtitle: 'Conte um pouco sobre você.',
  heading: 'Um título',
  text: 'Escreva sua história aqui.',
  alt: 'Descreva esta imagem',
  caption: 'Uma legenda para a imagem',
  button: 'Saiba mais',
};
export function getBlockPlaceholders(locale: string) {
  return locale === 'pt-BR' ? ptBR : en;
}
