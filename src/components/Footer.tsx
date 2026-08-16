import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import Logo from '../assets/logo';

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="w-full bg-[#050505] border-t border-white/5 py-8 mt-auto relative overflow-hidden select-none font-sans z-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-gray-400 font-medium text-sm">
            <Logo size={24} />
            <span className="font-serif tracking-wide text-white">
              Sarkar <span className="text-[#FF4500] italic font-semibold">Hamari</span> Hai<span className="text-[#FF4500]">.</span>
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-gray-500 text-xs font-mono uppercase tracking-widest">
            <Link to="/privacy" className="hover:text-white transition-colors">{t('footer.privacy')}</Link>
            <Link to="/terms" className="hover:text-white transition-colors">{t('footer.terms')}</Link>
            <a href="mailto:support@sarkarhamarihai.app" className="hover:text-white transition-colors">{t('footer.contact')}</a>
          </div>
          <p className="text-[10px] text-gray-600 font-mono tracking-wider text-center md:text-right">
            &copy; {new Date().getFullYear()} SarkarHamariHai. {t('footer.allRights')}
          </p>
        </div>
      </div>
    </footer>
  );
}
