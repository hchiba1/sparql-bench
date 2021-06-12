FROM ubuntu:20.04

ENV VIRTUOSO_VERSION 7.2.5.1

RUN echo deb http://security.ubuntu.com/ubuntu bionic-security main >> /etc/apt/sources.list
RUN apt-get update \
 && apt-get install -y --no-install-recommends wget unzip automake libtool flex bison gperf gawk libssl1.0-dev build-essential net-tools openssl \
 && wget --no-check-certificate https://github.com/openlink/virtuoso-opensource/archive/refs/tags/v${VIRTUOSO_VERSION}.zip \
 && unzip v${VIRTUOSO_VERSION}.zip \
 && cd virtuoso-opensource-${VIRTUOSO_VERSION} \
 && ./autogen.sh && ./configure && make && make install \
 && rm -r /v${VIRTUOSO_VERSION}.zip /virtuoso-opensource-${VIRTUOSO_VERSION}

ENV PATH /usr/local/virtuoso-opensource/bin/:$PATH

RUN DEBIAN_FRONTEND=noninteractive apt-get install -y git

WORKDIR /opt
RUN git clone https://github.com/sparqling/sparql-bench

# Install SPANG
RUN git clone https://github.com/hchiba1/spang
RUN wget https://deb.nodesource.com/setup_14.x -O - | bash -
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*
RUN cd /opt/spang \
 && npm install && npm link

WORKDIR /usr/local/virtuoso-opensource/var/lib/virtuoso/db
