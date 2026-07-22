// Minimal dependency-free tab component. Replaces the VanillaTabs library.
// Expects a container with class "tabs" whose direct <li data-title="..">
// children are the tab panels (same markup the old library used).
(function() {
    'use strict';

    function initTabs(root) {
        var panels = Array.prototype.slice.call(root.children).filter(function(el) {
            return el.tagName === 'LI';
        });

        if (!panels.length) return;

        var nav = document.createElement('div');
        nav.className = 'tab-nav';
        nav.setAttribute('role', 'tablist');

        panels.forEach(function(panel, index) {
            var title = panel.getAttribute('data-title') || ('Tab ' + (index + 1));

            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'tab-nav-button';
            button.textContent = title;
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');

            panel.classList.add('tab-panel');
            panel.setAttribute('role', 'tabpanel');
            panel.hidden = index !== 0;
            if (index === 0) {
                button.classList.add('active');
            }

            button.addEventListener('click', function() {
                panels.forEach(function(p) {
                    p.hidden = true;
                });
                nav.querySelectorAll('.tab-nav-button').forEach(function(b) {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                panel.hidden = false;
                button.classList.add('active');
                button.setAttribute('aria-selected', 'true');
            });

            nav.appendChild(button);
        });

        root.parentNode.insertBefore(nav, root);
    }

    document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('.tabs').forEach(initTabs);
    });
})();
