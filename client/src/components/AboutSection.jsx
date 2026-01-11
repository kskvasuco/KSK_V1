import React from 'react';
import '../pages/Home.css';

export default function AboutSection() {
    return (
        <section id="about" className="about-section">
            <div className="about-container">
                <div className="about-header">
                    <h2>About KSK VASU & Co.</h2>
                    <div className="about-divider"></div>
                </div>
                <div className="about-content">
                    <div className="about-image">
                        <img src="/images/head.png" alt="KSK VASU & Co." onError={(e) => e.target.style.display = 'none'} />
                    </div>
                    <div className="about-text">
                        <h3>Your Trusted Partner for Quality Construction Materials</h3>
                        <p>
                            KSK VASU & Co. has been serving the construction industry for decades, providing
                            premium quality building materials including bricks, Solid blocks, cement, M-sand, P-Sand and Hardware Materials.
                            Our commitment to quality and customer satisfaction has made us a trusted name in the industry.
                        </p>
                        <ul className="about-features">
                            <li>✓ Building Planning</li>
                            <li>✓ Hardware Solutions</li>
                            <li>✓ Premium Quality Products</li>
                            <li>✓ Competitive Pricing</li>
                            <li>✓ Fast & Reliable Delivery</li>
                            <li>✓ Expert Customer Support</li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}
