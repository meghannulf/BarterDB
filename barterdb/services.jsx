import React from 'react';

const Services = () => {
  const services = [
    { title: 'Item Exchange', description: 'Trade goods with other users securely and efficiently.' },
    { title: 'Service Bartering', description: 'Offer and receive services without the need for cash transactions.' },
    { title: 'Verified Listings', description: 'Ensuring all listed items and services are verified for authenticity.' },
    { title: 'Secure Transactions', description: 'Built-in protection to ensure fair and transparent trades.' }
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
      <h2 className="text-3xl font-bold mb-6">Our Services</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {services.map((service, index) => (
          <div key={index} className="bg-white p-6 rounded-lg shadow-md text-center">
            <h3 className="text-xl font-semibold mb-2">{service.title}</h3>
            <p className="text-gray-600">{service.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Services;
