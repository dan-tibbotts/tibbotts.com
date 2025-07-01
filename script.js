document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('header nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('show');
    });
  }

  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('header nav a');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const id = entry.target.getAttribute('id');
      const link = document.querySelector(`header nav a[href="#${id}"]`);
      if (entry.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        if (link) link.classList.add('active');
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.6 });

  sections.forEach(section => {
    observer.observe(section);
  });

  const filterButtons = document.querySelectorAll('.filter-btn');
  const projects = document.querySelectorAll('.project-item');

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      projects.forEach(p => {
        if (filter === 'all' || p.dataset.category === filter) {
          p.classList.remove('hidden');
        } else {
          p.classList.add('hidden');
        }
      });
    });
  });

  const modal = document.getElementById('modal');
  const modalImg = modal.querySelector('.modal-img');
  const modalBody = modal.querySelector('.modal-body');
  const closeBtn = modal.querySelector('.modal-close');
  let lastFocus;

  document.querySelectorAll('.project-item').forEach(item => {
    item.addEventListener('click', () => {
      lastFocus = document.activeElement;
      modalImg.src = item.querySelector('img').src;
      modalBody.textContent = item.dataset.description || '';
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      closeBtn.focus();
    });
  });

  function closeModal() {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    if (lastFocus) lastFocus.focus();
  }

  closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      closeModal();
    }
  });
});
