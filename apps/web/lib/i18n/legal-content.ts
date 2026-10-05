export type LegalSection = { title: string; paragraphs: string[] };
export const legalEn: { terms: LegalSection[]; privacy: LegalSection[] } = {
  terms: [
    {
      title: '1. About Folyo and these terms',
      paragraphs: [
        'Folyo lets you create, edit and publish a personal portfolio with a unique address. These terms govern the app, editor, storage and publication features. The service operator and legal contact appear below. The privacy policy explains how personal data is handled.',
        'By accepting this version, you agree to use Folyo under these terms. Material changes require a new acceptance before you resume account features; a new version does not silently change the content you have published.',
      ],
    },
    {
      title: '2. Your account and access',
      paragraphs: [
        'Sign in with your own Google account. Keep that account secure and provide accurate information. Do not share access, impersonate others or circumvent access controls. You are responsible for activity performed through your account, subject to rights and protections provided by law.',
        'Use the service only if you can validly accept these terms under applicable law. If you act for an organisation, you must have authority to publish its materials and accept these conditions.',
      ],
    },
    {
      title: '3. Your content and intellectual property',
      paragraphs: [
        'Your text, images and other portfolio materials remain yours or their respective owners’. Upload only material you are authorised to use, and obtain any necessary permission for names, photographs and personal information belonging to others.',
        'You grant Folyo a limited permission to store, process, display and distribute your materials solely to operate your portfolio and the service. This permission does not transfer ownership or authorise unrelated advertising use. It ends when the materials are removed, except for lawful retention, technical cleanup and necessary backup expiry. Template examples are fictitious and should be adapted before publication.',
      ],
    },
    {
      title: '4. Publication, addresses and removal',
      paragraphs: [
        'Publishing makes the current snapshot of your portfolio publicly accessible, including to search engines. Editor changes become public when you publish again. Preview links may be shared; avoid including private information in a preview or public portfolio.',
        'You can unpublish, delete your portfolio or delete your account in Settings. Portfolio deletion preserves your account but removes its pages, uploaded images and live publication. Its handle becomes available again and may later belong to someone else. Search-engine caches, third-party copies and bookmarks are outside Folyo’s direct control.',
      ],
    },
    {
      title: '5. Acceptable use',
      paragraphs: [
        'Do not publish unlawful material, phishing, malware, scams, unsolicited spam, impersonation, exploitation, threats, privacy violations or material that infringes someone else’s rights. Do not use Folyo to collect credentials, evade moderation, overload infrastructure or test systems without authorisation.',
        'Report suspected abuse through the report link. A report is an allegation, not a conclusion. The team may review, request clarification, restrict access or remove a publication where justified by law or these terms. Status changes in the moderation queue do not automatically remove content.',
      ],
    },
    {
      title: '6. Availability and service limits',
      paragraphs: [
        'Folyo is an MVP with defined limits for pages, blocks and uploaded files. Features may evolve, and maintenance or provider incidents can interrupt access. We take reasonable measures to protect the service but do not promise uninterrupted availability or permanent retention of an address.',
        'Keep your own copies of important content. Do not rely on Folyo as your sole archive or for safety-critical use. No provision excludes liability or statutory consumer rights that cannot lawfully be excluded.',
      ],
    },
    {
      title: '7. Privacy and third-party services',
      paragraphs: [
        'Google provides authentication; Cloudflare provides hosting, routing and object storage; Neon provides the database. Third-party services and websites linked in a portfolio have their own terms and privacy practices. A published snapshot may request font files from Google Fonts and images from external URLs chosen by the author.',
        'The MVP has no advertising or analytics integration. Optional advertising or measurement will require a separate technical and consent assessment before activation. Accepting these terms is not consent to optional tracking.',
      ],
    },
    {
      title: '8. Ending the relationship and disputes',
      paragraphs: [
        'You may stop using Folyo and delete your account. The operator may restrict access for serious misuse or legal obligations, with notice where appropriate and feasible. Necessary records may remain for legal claims or compliance as explained in the privacy policy.',
        'Contact the operator for questions, complaints or requests about these terms. Applicable mandatory law and competent courts remain available; these terms do not impose an exclusive forum that overrides your statutory rights. The operator must provide its jurisdiction and identification before public launch.',
      ],
    },
  ],
  privacy: [
    {
      title: '1. Who handles your data',
      paragraphs: [
        'Folyo provides portfolio creation and hosting. The operator identified below is responsible for deciding why and how app data is processed. Portfolio authors are responsible for the personal information they choose to publish about themselves or other people. This policy covers the app and Folyo’s technical hosting, not every external website linked by an author.',
      ],
    },
    {
      title: '2. Data we collect',
      paragraphs: [
        'Google authentication supplies your account identifier, name, email and avatar. We keep your locale, terms acceptance timestamp and version, site handle and preferences, portfolio pages and blocks, uploaded images, publication records and related storage metadata.',
        'Technical processing can include IP addresses, request timestamps, errors and security logs. Reports include the target portfolio, reason, optional details and review status. Please avoid sensitive information in reports. We do not request access to your Gmail messages, Google Drive documents or contacts.',
      ],
    },
    {
      title: '3. Purposes and legal grounds',
      paragraphs: [
        'We use account and content data to provide the service you request, secure access, publish your portfolio and support removal. Contract performance, legitimate interests in proportionate security and abuse prevention, legal obligations and consent where required are the relevant grounds, depending on the processing and applicable law.',
        'Optional cookies require a separate choice. You may refuse them without losing essential account features. Public content is displayed because the author chooses to publish it; publishing does not authorise Folyo to use it for unrelated purposes.',
      ],
    },
    {
      title: '4. Providers and international processing',
      paragraphs: [
        'Google OAuth authenticates your account; Cloudflare hosts the app, routes public sites and stores images and snapshots; Neon stores account and portfolio records. These providers may process data in countries other than yours. Before public launch, the operator must verify contracts, locations and applicable international-transfer safeguards.',
        'A published portfolio is accessible worldwide. External image URLs and Google Fonts can receive a visitor’s IP and browser information when requested. We do not sell personal data. Disclosure to authorities occurs only where a valid legal basis or obligation applies.',
      ],
    },
    {
      title: '5. Cookies and local preferences',
      paragraphs: [
        'Essential session and security cookies support login and prevent misuse. A cookie stores your cookie choice for twelve months. Local browser storage remembers preferences such as the editor sidebar and temporary success messages.',
        'The banner distinguishes accepting optional cookies from essential-only use. No optional tracker, analytics or advertising cookie is active in this MVP. Google login may involve cookies on Google’s own domains. Portfolio snapshots do not include the app cookie banner or optional tracker scripts.',
      ],
    },
    {
      title: '6. Retention and deletion',
      paragraphs: [
        'Account and portfolio records are kept while your account and portfolio are active. Deleting a portfolio removes its database records and publication routing while preserving the account. Deleting the account also removes its associated account records. Reports tied to a deleted portfolio are removed with it.',
        'Object removal can complete after database deletion when a storage provider is unavailable. A durable cleanup queue retries portfolio deletions; orphaned assets normally use a configurable seven-day grace period. Backups, necessary legal records and provider security logs can have separate retention periods. The operator must document those periods before launch; records must not be retained indefinitely without a purpose.',
      ],
    },
    {
      title: '7. Your rights',
      paragraphs: [
        'Where applicable, you can request access, correction, deletion, portability, information about sharing, restriction or objection, and withdraw consent. LGPD rights include confirmation of processing and review of automated decisions; Folyo does not make automated decisions with legal or similarly significant effects.',
        'Correct portfolio content in the editor. Delete your account in Settings to request removal through the available self-service flow. For other requests, contact the operator; identity verification may be necessary. You can also contact the ANPD or the competent data-protection authority. Statutory exceptions and response deadlines apply.',
      ],
    },
    {
      title: '8. Security, children and policy changes',
      paragraphs: [
        'We use authenticated access, ownership checks and secure service connections, but no system is risk-free. Do not upload secrets, sensitive records or information you are not authorised to publish. Contact the operator if you suspect a security incident.',
        'The service is not directed at children who cannot validly accept its terms. If a child’s data has been submitted improperly, contact the operator for assessment and removal. This policy is versioned with the terms; material changes are explained and any required new consent is requested separately.',
      ],
    },
  ],
};
export const legalPt: typeof legalEn = {
  terms: [
    {
      title: '1. Sobre o Folyo e estes termos',
      paragraphs: [
        'O Folyo permite criar, editar e publicar um portfólio pessoal com um endereço único. Estes termos regulam o app, o editor, o armazenamento e a publicação. A identificação do responsável e o contato legal aparecem abaixo. A Política de Privacidade explica o tratamento de dados pessoais.',
        'Ao aceitar esta versão, você concorda em usar o Folyo nestas condições. Mudanças relevantes exigem novo aceite antes de retomar funções da conta; uma nova versão não altera silenciosamente o conteúdo já publicado.',
      ],
    },
    {
      title: '2. Sua conta e acesso',
      paragraphs: [
        'Entre com sua própria conta Google. Proteja esse acesso e forneça informações corretas. Não compartilhe credenciais, se passe por outra pessoa nem contorne controles de acesso. Você responde pelo uso realizado pela sua conta, respeitados os direitos e garantias legais.',
        'Use o serviço apenas se puder aceitar validamente estes termos conforme a lei aplicável. Se atuar por uma organização, tenha autorização para publicar os materiais e aceitar estas condições.',
      ],
    },
    {
      title: '3. Conteúdo e propriedade intelectual',
      paragraphs: [
        'Seus textos, imagens e demais materiais continuam sendo seus ou dos respectivos titulares. Envie apenas conteúdo que tenha autorização para usar e obtenha as permissões necessárias para nomes, fotografias e dados pessoais de terceiros.',
        'Você concede ao Folyo uma autorização limitada para armazenar, processar, exibir e distribuir os materiais somente para operar seu portfólio e o serviço. Não há transferência de propriedade nem autorização para publicidade alheia a essa finalidade. A autorização termina com a remoção, ressalvados retenção legal, limpeza técnica e expiração necessária de backups. Os exemplos dos templates são fictícios e devem ser adaptados antes da publicação.',
      ],
    },
    {
      title: '4. Publicação, endereços e remoção',
      paragraphs: [
        'Publicar torna o snapshot atual do portfólio acessível ao público, inclusive a buscadores. Alterações do editor ficam públicas ao republicar. Links de preview podem ser compartilhados; evite informações privadas no preview ou no portfólio público.',
        'Você pode despublicar, excluir o portfólio ou excluir a conta em Configurações. Excluir o portfólio preserva a conta e remove páginas, imagens enviadas e publicação no ar. O handle fica disponível novamente e pode pertencer a outra pessoa no futuro. Caches de buscadores, cópias de terceiros e favoritos não estão sob controle direto do Folyo.',
      ],
    },
    {
      title: '5. Uso permitido e denúncias',
      paragraphs: [
        'Não publique conteúdo ilegal, phishing, malware, golpes, spam, impersonação, exploração, ameaças, violações de privacidade ou materiais que infrinjam direitos de terceiros. Não use o Folyo para coletar credenciais, burlar moderação, sobrecarregar a infraestrutura ou testar sistemas sem autorização.',
        'Denuncie suspeitas de abuso pelo link de denúncia. Uma denúncia é uma alegação, não uma conclusão. A equipe pode analisar, pedir esclarecimentos, restringir acesso ou remover uma publicação quando a lei ou estes termos justificarem. Alterar o status na fila de moderação não remove conteúdo automaticamente.',
      ],
    },
    {
      title: '6. Disponibilidade e limites',
      paragraphs: [
        'O Folyo é um MVP com limites de páginas, blocos e arquivos. As funcionalidades podem evoluir e manutenções ou incidentes em fornecedores podem interromper o acesso. Adotamos medidas razoáveis de proteção, sem prometer disponibilidade ininterrupta ou conservação permanente de um endereço.',
        'Mantenha cópias próprias de conteúdo importante. Não use o Folyo como arquivo único nem para finalidades críticas de segurança. Nenhuma disposição exclui responsabilidade ou direitos do consumidor que a lei não permita excluir.',
      ],
    },
    {
      title: '7. Privacidade e serviços de terceiros',
      paragraphs: [
        'O Google fornece autenticação; a Cloudflare fornece hospedagem, roteamento e armazenamento de objetos; a Neon fornece o banco de dados. Serviços externos e sites linkados pelo autor possuem termos e práticas próprios. Um snapshot publicado pode solicitar fontes do Google Fonts e imagens em URLs externas escolhidas pelo autor.',
        'O MVP não integra publicidade ou analytics. Eventuais cookies de publicidade ou medição exigirão avaliação técnica e de consentimento antes de sua ativação. Aceitar estes termos não significa consentir com rastreamento opcional.',
      ],
    },
    {
      title: '8. Encerramento, contato e conflitos',
      paragraphs: [
        'Você pode deixar de usar o Folyo e excluir sua conta. O responsável pode restringir o acesso por uso indevido grave ou obrigação legal, com aviso quando adequado e viável. Registros necessários podem permanecer para obrigações legais ou exercício de direitos, conforme a Política de Privacidade.',
        'Entre em contato com o responsável para dúvidas, reclamações ou pedidos sobre estes termos. Permanecem aplicáveis a legislação obrigatória e os órgãos competentes; estes termos não impõem foro exclusivo que afaste direitos legais. A jurisdição e a identificação do responsável devem ser informadas antes do lançamento público.',
      ],
    },
  ],
  privacy: [
    {
      title: '1. Quem trata seus dados',
      paragraphs: [
        'O Folyo oferece criação e hospedagem de portfólios. O responsável identificado abaixo define por que e como os dados do app são tratados. Autores respondem pelos dados pessoais que escolhem publicar sobre si ou terceiros. Esta política cobre o app e a hospedagem técnica do Folyo, não todo site externo linkado por um autor.',
      ],
    },
    {
      title: '2. Dados coletados',
      paragraphs: [
        'A autenticação Google fornece identificador da conta, nome, e-mail e avatar. Guardamos idioma, data e versão do aceite, handle e preferências do site, páginas e blocos, imagens enviadas, registros de publicação e metadados de armazenamento.',
        'O processamento técnico pode incluir IP, horário de solicitações, erros e logs de segurança. Denúncias contêm portfólio alvo, motivo, detalhes opcionais e status de análise. Evite informações sensíveis nos detalhes. Não solicitamos acesso a mensagens do Gmail, documentos do Google Drive ou contatos.',
      ],
    },
    {
      title: '3. Finalidades e bases legais',
      paragraphs: [
        'Usamos dados de conta e conteúdo para prestar o serviço solicitado, proteger o acesso, publicar o portfólio e permitir remoção. Conforme o tratamento e a lei aplicável, as bases relevantes são execução de contrato, legítimo interesse em segurança e prevenção proporcional de abuso, obrigação legal e consentimento quando necessário.',
        'Cookies opcionais dependem de uma escolha separada. Recusá-los não impede as funções essenciais. Conteúdo público é exibido porque o autor escolhe publicar; isso não autoriza o Folyo a usá-lo para finalidades alheias ao serviço.',
      ],
    },
    {
      title: '4. Fornecedores e processamento internacional',
      paragraphs: [
        'Google OAuth autentica sua conta; Cloudflare hospeda o app, roteia os sites e armazena imagens e snapshots; Neon armazena registros de contas e portfólios. Esses fornecedores podem tratar dados fora do seu país. Antes do lançamento, o responsável deve verificar contratos, localidades e salvaguardas de transferência internacional aplicáveis.',
        'Um portfólio publicado é acessível mundialmente. URLs externas de imagens e Google Fonts podem receber IP e informações do navegador do visitante ao serem solicitados. Não vendemos dados pessoais. Compartilhamento com autoridades depende de base ou obrigação legal válida.',
      ],
    },
    {
      title: '5. Cookies e preferências locais',
      paragraphs: [
        'Cookies essenciais de sessão e segurança permitem login e previnem uso indevido. Um cookie guarda sua escolha sobre cookies por doze meses. O armazenamento local do navegador lembra preferências como a sidebar do editor e mensagens temporárias de sucesso.',
        'O banner diferencia aceite de cookies opcionais de uso apenas dos essenciais. O MVP não ativa rastreadores opcionais, analytics ou publicidade. O login Google pode envolver cookies nos domínios do Google. Snapshots de portfólio não incluem o banner do app ou scripts de rastreamento opcionais.',
      ],
    },
    {
      title: '6. Retenção e exclusão',
      paragraphs: [
        'Mantemos registros de conta e portfólio enquanto estiverem ativos. Excluir o portfólio remove seus dados no banco e o roteamento público, preservando a conta. Excluir a conta também remove os registros de conta associados. Denúncias vinculadas a um portfólio excluído são removidas com ele.',
        'A remoção de objetos pode terminar depois da exclusão no banco se o storage estiver indisponível. Uma fila persistente retenta exclusões de portfólio; assets órfãos normalmente usam carência configurável de sete dias. Backups, registros legais necessários e logs dos fornecedores podem ter prazos próprios. O responsável deve documentá-los antes do lançamento; não cabe retenção indefinida sem finalidade.',
      ],
    },
    {
      title: '7. Seus direitos',
      paragraphs: [
        'Quando aplicável, você pode pedir acesso, correção, exclusão, portabilidade, informação sobre compartilhamento, limitação ou oposição e revogar consentimento. A LGPD também prevê confirmação do tratamento e revisão de decisões automatizadas; o Folyo não toma decisões automatizadas com efeitos jurídicos ou semelhantes.',
        'Corrija o conteúdo no editor. Exclua a conta em Configurações para solicitar remoção pelo fluxo disponível. Para outros pedidos, contate o responsável; pode ser necessário verificar sua identidade. Você também pode procurar a ANPD ou autoridade competente. Aplicam-se as exceções e os prazos legais.',
      ],
    },
    {
      title: '8. Segurança, crianças e alterações',
      paragraphs: [
        'Usamos autenticação, checagens de propriedade e conexões seguras com os serviços, mas nenhum sistema é livre de riscos. Não envie segredos, registros sensíveis ou informações que não possa publicar. Avise o responsável se suspeitar de um incidente.',
        'O serviço não é dirigido a crianças que não possam aceitar validamente os termos. Se dados de uma criança forem enviados indevidamente, contate o responsável para avaliação e remoção. Esta política acompanha a versão dos termos; mudanças relevantes serão explicadas e um novo consentimento necessário será solicitado separadamente.',
      ],
    },
  ],
};
